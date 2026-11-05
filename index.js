import z from "@deepseek-ai/schemastery";
import { Service } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { markRemoteMethod } from "./mark-remote.js";

const USER_AGENT = "dsh-plugin-discovery/1.0";

function githubHeaders(token) {
	const headers = {
		Accept: "application/vnd.github+json",
		"User-Agent": USER_AGENT,
		"X-GitHub-Api-Version": "2022-11-28",
	};
	if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
	return headers;
}

function parseGithubRepoUrl(input) {
	const trimmed = input.trim();
	try {
		const url = new URL(trimmed);
		if (!/github\.com$/i.test(url.hostname.replace(/^www\./, ""))) return null;
		const parts = url.pathname.split("/").filter(Boolean);
		if (parts.length < 2) return null;
		const owner = parts[0];
		const repo = parts[1].replace(/\.git$/, "");
		return { spec: `github:${owner}/${repo}`, owner, repo };
	} catch {
		return null;
	}
}

function parseNpmPackageUrl(input) {
	const trimmed = input.trim();
	if (/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i.test(trimmed)) {
		return { spec: trimmed };
	}
	try {
		const url = new URL(trimmed);
		if (!/npmjs\.com$/i.test(url.hostname.replace(/^www\./, ""))) return null;
		const match = url.pathname.match(/^\/package\/((?:@[^/]+\/)?[^/]+)/);
		if (!match) return null;
		return { spec: decodeURIComponent(match[1]) };
	} catch {
		return null;
	}
}

function parseGithubShortRepo(input) {
	const trimmed = input.trim();
	const match = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
	if (!match) return null;
	return { spec: `github:${match[1]}/${match[2]}`, owner: match[1], repo: match[2] };
}

function resolveInputToSpec(input) {
	const trimmed = input.trim();
	if (!trimmed) return null;
	if (/^(github:|gitlab:|bitbucket:)/i.test(trimmed)) return { spec: trimmed, source: "git" };
	const gh = parseGithubRepoUrl(trimmed);
	if (gh) return { ...gh, source: "github" };
	const short = parseGithubShortRepo(trimmed);
	if (short) return { ...short, source: "github" };
	const npm = parseNpmPackageUrl(trimmed);
	if (npm) return { ...npm, source: "npm" };
	return null;
}

async function fetchJson(url, init = {}) {
	const response = await fetch(url, init);
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
	}
	return response.json();
}

async function searchNpm(query, limit) {
	const params = new URLSearchParams({
		text: `${query} dsh`,
		size: String(Math.min(limit, 50)),
	});
	const data = await fetchJson(`https://registry.npmjs.org/-/v1/search?${params}`);
	const items = Array.isArray(data.objects) ? data.objects : [];
	return items.map((row) => {
		const pkg = row.package || {};
		return {
			source: "npm",
			spec: pkg.name,
			title: pkg.name,
			description: pkg.description || "",
			url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
			stars: null,
		};
	});
}

function mapGithubRepos(items) {
	return (Array.isArray(items) ? items : []).map((repo) => ({
		source: "github",
		spec: `github:${repo.full_name}`,
		title: repo.full_name,
		description: repo.description || "",
		url: repo.html_url,
		stars: repo.stargazers_count ?? null,
	}));
}

async function githubSearchOnce(q, limit, token) {
	const params = new URLSearchParams({
		q,
		sort: "updated",
		order: "desc",
		per_page: String(Math.min(limit, 30)),
	});
	const data = await fetchJson(`https://api.github.com/search/repositories?${params}`, {
		headers: githubHeaders(token),
	});
	return mapGithubRepos(data.items);
}

async function searchGithub(query, limit, token) {
	const trimmed = String(query || "").trim();
	// 与 GitHub 网页搜索对齐：先用原关键词；再用 topic 收窄社区插件
	const queries = trimmed
		? [trimmed, `${trimmed} topic:dsh-plugin`, `${trimmed} topic:dsh`]
		: ["topic:dsh-plugin", "topic:dsh"];
	const seen = new Set();
	const merged = [];
	let lastError = null;
	for (const q of queries) {
		if (merged.length >= limit) break;
		try {
			const batch = await githubSearchOnce(q, limit, token);
			for (const row of batch) {
				if (seen.has(row.spec)) continue;
				seen.add(row.spec);
				merged.push(row);
				if (merged.length >= limit) break;
			}
		} catch (error) {
			lastError = error;
			// 无 token 时未认证配额很低；已有结果则返回，否则抛出给上层提示
			if (!merged.length && /rate limit|API rate limit/i.test(String(error && error.message))) {
				throw new Error("GitHub API 速率受限，请在插件配置里填写 githubToken，或稍后再试");
			}
			if (!merged.length) continue;
			break;
		}
	}
	if (!merged.length && lastError) throw lastError;
	return merged;
}

function cacheKey(query, source) {
	return `${source}:${query.trim().toLowerCase()}`;
}

class PluginDiscoveryService extends TypertRemoteService {
	static inject = ["tools", "pluginManager"];
	static Config = z.object({
		enabled: z.boolean().default(true),
		searchCacheTtlMs: z.number().min(0).max(86400000).default(300000),
		maxCandidates: z.number().min(1).max(50).default(20),
		maxInspect: z.number().min(0).max(30).default(10),
		githubToken: z.string().default(""),
		openPanelOnLoad: z.boolean().default(false),
	});

	constructor(ctx, config) {
		super(ctx, "pluginDiscovery");
		this.config = config;
		this.cache = new Map();
		this.ctx.effect(() => this.registerTools());
	}

	getFromCache(key) {
		const hit = this.cache.get(key);
		if (!hit) return null;
		if (Date.now() - hit.at > this.config.searchCacheTtlMs) {
			this.cache.delete(key);
			return null;
		}
		return hit.payload;
	}

	setCache(key, payload) {
		this.cache.set(key, { at: Date.now(), payload });
	}

	async inspectCandidate(spec, signal) {
		try {
			const inspection = await this.ctx.pluginManager.inspect(spec, {}, signal);
			if (inspection.status !== "accepted") {
				return {
					spec,
					accepted: false,
					bundle: false,
					reason: inspection.status === "refused" ? inspection.reason : "refused",
				};
			}
			return {
				spec,
				accepted: true,
				bundle: inspection.bundle === true,
				name: inspection.name,
				version: inspection.version,
				description: inspection.description,
			};
		} catch (error) {
			return {
				spec,
				accepted: false,
				bundle: false,
				reason: error instanceof Error ? error.message : String(error),
			};
		}
	}

	async enrichCandidates(candidates, signal) {
		const limit = this.config.maxInspect;
		const slice = candidates.slice(0, limit);
		const verified = [];
		for (const row of slice) {
			if (signal?.aborted) break;
			const meta = await this.inspectCandidate(row.spec, signal);
			if (meta.bundle) {
				verified.push({
					...row,
					...meta,
					installSpec: row.spec,
				});
			}
		}
		return verified;
	}

	async search(query, options) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用", results: [], total: 0 };
		}
		const opts = options && typeof options === "object" ? options : {};
		const q = String(query || "").trim() || "dsh";
		const source = opts.source === "npm" || opts.source === "github" ? opts.source : "all";
		const verify = opts.verify === true;
		const key = `${cacheKey(q, source)}:v${verify ? 1 : 0}`;
		const cached = this.getFromCache(key);
		if (cached && !opts.skipCache) {
			return { ok: true, cached: true, query: q, source, verify, results: cached, total: cached.length };
		}

		const limit = this.config.maxCandidates;
		const token = opts.githubToken ?? this.config.githubToken;
		let raw = [];
		try {
			if (source === "npm" || source === "all") {
				raw = raw.concat(await searchNpm(q, limit));
			}
			if (source === "github" || source === "all") {
				raw = raw.concat(await searchGithub(q, limit, token));
			}
		} catch (error) {
			this.ctx.logger.warn("[plugin-discovery] search failed", error);
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error),
				results: [],
				total: 0,
			};
		}

		const seen = new Set();
		const deduped = [];
		for (const row of raw) {
			if (!row.spec || seen.has(row.spec)) continue;
			seen.add(row.spec);
			deduped.push({
				...row,
				installSpec: row.spec,
				bundle: null,
			});
			if (deduped.length >= limit) break;
		}

		let results = deduped;
		if (verify) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 120000);
			try {
				results = await this.enrichCandidates(deduped, controller.signal);
			} finally {
				clearTimeout(timeout);
			}
		}

		this.setCache(key, results);
		return { ok: true, cached: false, query: q, source, verify, results, total: results.length };
	}

	async resolve(input) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用" };
		}
		const parsed = resolveInputToSpec(input);
		if (!parsed?.spec) {
			return {
				ok: false,
				message:
					"解析安装需要完整链接或包名（如 https://github.com/user/repo、user/repo、npm 包名）。关键词请用上方「搜索」。",
			};
		}
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 90000);
		let meta;
		try {
			meta = await this.inspectCandidate(parsed.spec, controller.signal);
		} finally {
			clearTimeout(timeout);
		}
		return {
			ok: meta.bundle,
			spec: parsed.spec,
			source: parsed.source,
			inspection: meta,
			message: meta.bundle ? "可安装的 DSH Bundle" : meta.reason || "不是 DSH Bundle 或 inspect 失败",
		};
	}

	async listInstalled() {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用", names: [], bundles: [] };
		}
		try {
			const [bundles, plugins] = await Promise.all([
				this.ctx.pluginManager.listBundles(),
				this.ctx.pluginManager.listPlugins(),
			]);
			const rows = (Array.isArray(bundles) ? bundles : []).map((bundle) => ({
				name: bundle.name,
				version: bundle.version,
				enabled: bundle.enabled === true,
				installed: bundle.installed === true,
			}));
			const names = new Set(rows.map((row) => row.name).filter(Boolean));
			for (const plugin of Array.isArray(plugins) ? plugins : []) {
				const moduleName = plugin && plugin.moduleName;
				if (!moduleName) continue;
				names.add(moduleName);
			}
			return {
				ok: true,
				names: [...names],
				bundles: rows,
			};
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error),
				names: [],
				bundles: [],
			};
		}
	}

	async findExistingBundleName(candidates) {
		const listed = await this.listInstalled();
		if (!listed.ok) return { existing: null, listed };
		const names = new Set(listed.names);
		// 仅精确匹配包名/spec，避免 dsh-pet 与 @scope/dsh-pet 互相误判为已安装
		for (const candidate of candidates) {
			if (!candidate) continue;
			if (names.has(candidate)) return { existing: candidate, listed };
		}
		return { existing: null, listed };
	}

	async installPlugin(spec, options) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用" };
		}
		const trimmed = String(spec || "").trim();
		if (!trimmed) {
			return { ok: false, message: "安装 spec 为空" };
		}
		const opts = options && typeof options === "object" ? options : {};
		const requestId =
			typeof opts.requestId === "string" && opts.requestId.trim()
				? opts.requestId.trim()
				: globalThis.crypto?.randomUUID?.() || `pd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		const pre = await this.inspectCandidate(trimmed);
		if (!pre.bundle) {
			return { ok: false, requestId, message: pre.reason || "该 spec 不是可安装的 DSH Bundle" };
		}
		const { existing } = await this.findExistingBundleName([pre.name, trimmed]);
		if (existing) {
			return {
				ok: false,
				alreadyInstalled: true,
				packageName: existing,
				requestId,
				message: `「${existing}」已在 DSH 插件列表中，无需重复安装。请到「插件」页查看。`,
			};
		}
		try {
			const result = await this.ctx.pluginManager.installBundle(trimmed, {
				requestId,
				enabled: true,
			});
			const packageName = result?.bundle || pre.name || trimmed;
			const application = result?.application;
			const failed = application === "failed" || application === "cancelled";
			return {
				ok: !failed,
				alreadyInstalled: false,
				packageName,
				requestId,
				application,
				stage: result?.stage,
				message: failed
					? result?.error?.message || `安装失败（${application || "unknown"}）`
					: `「${packageName}」安装完成（${application || "applied"} / ${result?.stage || "install"}）`,
				result,
			};
		} catch (error) {
			return {
				ok: false,
				requestId,
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}

	async waitInstall(requestId) {
		const id = String(requestId || "").trim();
		if (!id) return { ok: false, message: "requestId 为空", settled: null };
		try {
			const settled = await this.ctx.pluginManager.waitForInstall(id);
			if (settled == null) {
				return { ok: true, settled: null, pending: true, message: "安装仍在进行或已丢失" };
			}
			const failed = settled.application === "failed" || settled.application === "cancelled";
			return {
				ok: !failed,
				settled,
				pending: false,
				packageName: settled.bundle,
				application: settled.application,
				stage: settled.stage,
				message: failed
					? settled.error?.message || `安装失败（${settled.application}）`
					: `安装完成（${settled.application} / ${settled.stage}）`,
			};
		} catch (error) {
			return {
				ok: false,
				settled: null,
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}

	registerTools() {
		const service = this;
		const disposers = [];
		const present = (title) => ({ title, kind: "read" });
		const toolOutput = {
			schema: { type: "object", additionalProperties: true },
			render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
		};
		disposers.push(
			this.ctx.tools.register(
				defineTool({
					name: "plugin_discovery_search",
					description:
						"Search GitHub and npm for community DSH plugin bundles (online only). Returns verified bundle install specs. Does not install.",
					parameters: {
						query: { type: "string", required: true, description: "Search keywords" },
						source: {
							type: "string",
							enum: ["all", "npm", "github"],
							description: "Limit search source",
						},
					},
					output: toolOutput,
					async execute(args) {
						return service.search(args.query, { source: args.source || "all" });
					},
					presentCall: (_args, partial) =>
						present(`Search DSH plugins: ${partial?.query ?? "…"}`),
				}),
			),
		);
		disposers.push(
			this.ctx.tools.register(
				defineTool({
					name: "plugin_discovery_resolve",
					description: "Resolve an npm or GitHub URL/package name and inspect whether it is a DSH bundle.",
					parameters: {
						input: {
							type: "string",
							required: true,
							description: "npm URL, GitHub repo URL, or package name",
						},
					},
					output: toolOutput,
					async execute(args) {
						return service.resolve(args.input);
					},
					presentCall: () => present("Resolve plugin URL"),
				}),
			),
		);
		return () => {
			for (const dispose of disposers.reverse()) dispose();
		};
	}

	async [Service.init]() {}
}

markRemoteMethod(PluginDiscoveryService.prototype, "search");
markRemoteMethod(PluginDiscoveryService.prototype, "resolve");
markRemoteMethod(PluginDiscoveryService.prototype, "installPlugin");
markRemoteMethod(PluginDiscoveryService.prototype, "listInstalled");
markRemoteMethod(PluginDiscoveryService.prototype, "waitInstall");

export default PluginDiscoveryService;
