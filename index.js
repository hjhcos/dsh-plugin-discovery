import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { Service } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { markRemoteMethod } from "./mark-remote.js";

const USER_AGENT = "dsh-plugin-discovery/1.1";
const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_CATALOG_GITEE_URL =
	"https://gitee.com/hjhcos/dsh-plugin-discovery/raw/main/data/recommended.json";
const DEFAULT_CATALOG_GITHUB_URL =
	"https://raw.githubusercontent.com/hjhcos/dsh-plugin-discovery/main/data/recommended.json";

function emptyCatalog(error) {
	return {
		version: 0,
		updatedAt: "",
		categories: [],
		plugins: [],
		origin: "none",
		error: error ? String(error) : undefined,
	};
}

function normalizeCatalog(data, origin = "bundled") {
	if (!data || typeof data !== "object") return emptyCatalog("invalid catalog");
	return {
		version: Number(data.version) || 0,
		updatedAt: data.updatedAt || "",
		categories: Array.isArray(data.categories) ? data.categories : [],
		plugins: Array.isArray(data.plugins) ? data.plugins : [],
		origin,
	};
}

function loadBundledCatalog() {
	try {
		const raw = readFileSync(join(__dirname, "data", "recommended.json"), "utf8");
		return normalizeCatalog(JSON.parse(raw), "bundled");
	} catch (error) {
		return emptyCatalog(error?.message || error);
	}
}

function resolveCatalogCachePath() {
	const home = String(process.env.DSH_HOME || "").trim();
	const base = home || join(__dirname, ".cache");
	return join(base, "cache", "dsh-plugin-discovery", "recommended.json");
}

function loadCachedCatalog() {
	try {
		const raw = readFileSync(resolveCatalogCachePath(), "utf8");
		return normalizeCatalog(JSON.parse(raw), "cache");
	} catch {
		return null;
	}
}

function saveCachedCatalog(catalog) {
	const path = resolveCatalogCachePath();
	mkdirSync(dirname(path), { recursive: true });
	const payload = {
		version: catalog.version,
		updatedAt: catalog.updatedAt,
		note: catalog.note,
		categories: catalog.categories,
		plugins: catalog.plugins,
		_cachedAt: new Date().toISOString(),
		_origin: catalog.origin,
	};
	writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
}

function pickNewerCatalog(...candidates) {
	let best = null;
	for (const row of candidates) {
		if (!row || !Array.isArray(row.plugins)) continue;
		if (!best || (row.version || 0) > (best.version || 0)) best = row;
		else if ((row.version || 0) === (best.version || 0) && row.origin !== "bundled" && best.origin === "bundled") {
			best = row;
		}
	}
	return best || emptyCatalog();
}

async function fetchCatalogFromUrl(url, timeoutMs = 12000) {
	const trimmed = String(url || "").trim();
	if (!trimmed) return null;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(trimmed, {
			headers: {
				Accept: "application/json,text/plain,*/*",
				"User-Agent": USER_AGENT,
			},
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const text = await response.text();
		const data = JSON.parse(text);
		if (!Array.isArray(data.plugins)) {
			throw new Error("catalog missing plugins[]");
		}
		const host = (() => {
			try {
				return new URL(trimmed).hostname;
			} catch {
				return "";
			}
		})();
		const origin = /gitee\.com/i.test(host) ? "gitee" : /githubusercontent\.com|github\.com/i.test(host) ? "github" : "remote";
		return normalizeCatalog(data, origin);
	} finally {
		clearTimeout(timer);
	}
}

function mapCatalogPlugin(row) {
	return {
		source: row.source || "npm",
		spec: row.spec,
		installSpec: row.spec,
		title: row.title || row.spec,
		description: row.description || "",
		url: row.url || `https://www.npmjs.com/package/${row.spec}`,
		stars: null,
		bundle: null,
		categories: Array.isArray(row.categories) ? row.categories : [],
		tags: Array.isArray(row.tags) ? row.tags : [],
		featured: row.featured === true,
		rank: typeof row.rank === "number" ? row.rank : 0,
		related: Array.isArray(row.related) ? row.related : [],
		catalogId: row.id || row.spec,
		reason: row.reason || null,
	};
}

function filterCatalogPlugins(catalog, { category, query, personalize, installedNames }) {
	const installed = new Set(
		(Array.isArray(installedNames) ? installedNames : []).map((name) => String(name || "").trim()).filter(Boolean),
	);
	const allPlugins = Array.isArray(catalog?.plugins) ? catalog.plugins : [];
	let rows = allPlugins.slice();

	if (category && category !== "all") {
		if (category === "featured") {
			rows = rows.filter((row) => row.featured === true || (row.categories || []).includes("featured"));
		} else {
			rows = rows.filter((row) => (row.categories || []).includes(category));
		}
	}

	const q = String(query || "")
		.trim()
		.toLowerCase();
	if (q) {
		rows = rows.filter((row) => {
			const hay = [row.spec, row.title, row.description, ...(row.tags || []), ...(row.categories || [])]
				.join(" ")
				.toLowerCase();
			return hay.includes(q);
		});
	}

	if (personalize) {
		const categoryScore = new Map();
		const installedSpecs = new Set();
		for (const row of allPlugins) {
			if (!installed.has(row.spec) && !installed.has(row.title) && !installed.has(row.id)) continue;
			installedSpecs.add(row.spec);
			for (const cat of row.categories || []) {
				if (cat === "featured") continue;
				categoryScore.set(cat, (categoryScore.get(cat) || 0) + 2);
			}
			for (const rel of row.related || []) {
				categoryScore.set(`rel:${rel}`, (categoryScore.get(`rel:${rel}`) || 0) + 5);
			}
		}

		const scored = rows
			.filter((row) => !installed.has(row.spec) && !installedSpecs.has(row.spec))
			.map((row) => {
				let score = (row.rank || 0) + (row.featured ? 12 : 0);
				const reasons = [];
				for (const cat of row.categories || []) {
					if (cat === "featured") continue;
					const boost = categoryScore.get(cat) || 0;
					if (boost) {
						score += boost * 3;
						reasons.push(cat);
					}
				}
				const relBoost = categoryScore.get(`rel:${row.spec}`) || 0;
				if (relBoost) {
					score += relBoost;
					reasons.push("related");
				}
				if (!reasons.length && row.featured) reasons.push("featured");
				return { ...row, reason: reasons[0] || (row.featured ? "featured" : "popular"), _score: score };
			});

		scored.sort((a, b) => b._score - a._score || String(a.spec).localeCompare(String(b.spec)));
		return scored.map(({ _score, ...rest }) => rest);
	}

	rows.sort((a, b) => (b.rank || 0) - (a.rank || 0) || String(a.spec).localeCompare(String(b.spec)));
	return rows;
}

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
		/** 是否从远程 raw JSON 自动刷新推荐目录（优先 Gitee） */
		catalogRemoteEnabled: z.boolean().default(true),
		catalogGiteeUrl: z.string().default(DEFAULT_CATALOG_GITEE_URL),
		catalogGithubUrl: z.string().default(DEFAULT_CATALOG_GITHUB_URL),
		/** 远程检查间隔；期间复用内存/磁盘缓存 */
		catalogRefreshTtlMs: z.number().min(0).max(86400000 * 7).default(3600000),
	});

	constructor(ctx, config) {
		super(ctx, "pluginDiscovery");
		this.config = config;
		this.cache = new Map();
		this.catalog = pickNewerCatalog(loadBundledCatalog(), loadCachedCatalog());
		this.catalogCheckedAt = 0;
		this.catalogRefreshPromise = null;
		this.ctx.effect(() => this.registerTools());
		// 启动后后台拉一次，不阻塞启动
		this.ctx.effect(() => {
			void this.refreshCatalog({ force: false }).catch(() => {});
			return () => {};
		});
	}

	getCatalog() {
		return this.catalog || loadBundledCatalog();
	}

	catalogMeta() {
		const catalog = this.getCatalog();
		return {
			version: catalog.version || 0,
			updatedAt: catalog.updatedAt || "",
			origin: catalog.origin || "bundled",
			checkedAt: this.catalogCheckedAt || null,
		};
	}

	remoteCatalogUrls() {
		const urls = [];
		const gitee = String(this.config.catalogGiteeUrl || "").trim();
		const github = String(this.config.catalogGithubUrl || "").trim();
		if (gitee) urls.push({ url: gitee, label: "gitee" });
		if (github) urls.push({ url: github, label: "github" });
		return urls;
	}

	async refreshCatalog(options = {}) {
		const force = options.force === true;
		if (!this.config.catalogRemoteEnabled) {
			return { ok: true, skipped: true, reason: "remote disabled", catalog: this.catalogMeta() };
		}
		const ttl = this.config.catalogRefreshTtlMs ?? 3600000;
		if (!force && this.catalogCheckedAt && Date.now() - this.catalogCheckedAt < ttl) {
			return { ok: true, skipped: true, reason: "ttl", catalog: this.catalogMeta() };
		}
		if (this.catalogRefreshPromise) return this.catalogRefreshPromise;

		this.catalogRefreshPromise = (async () => {
			const errors = [];
			let remote = null;
			for (const entry of this.remoteCatalogUrls()) {
				try {
					remote = await fetchCatalogFromUrl(entry.url);
					if (remote) {
						remote.origin = entry.label || remote.origin;
						break;
					}
				} catch (error) {
					errors.push(`${entry.label}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
			this.catalogCheckedAt = Date.now();
			if (!remote) {
				return {
					ok: false,
					message: errors.join("; ") || "remote catalog unavailable",
					catalog: this.catalogMeta(),
				};
			}
			const current = this.getCatalog();
			if ((remote.version || 0) > (current.version || 0)) {
				this.catalog = remote;
				try {
					saveCachedCatalog(remote);
				} catch (error) {
					this.ctx.logger?.warn?.("[plugin-discovery] save catalog cache failed", error);
				}
				this.ctx.logger?.info?.(
					`[plugin-discovery] catalog updated ${current.version} -> ${remote.version} via ${remote.origin}`,
				);
				return {
					ok: true,
					updated: true,
					from: current.version,
					to: remote.version,
					origin: remote.origin,
					catalog: this.catalogMeta(),
				};
			}
			// 同版本也刷新缓存时间戳，便于离线复用最近一次成功源
			if ((remote.version || 0) === (current.version || 0) && remote.origin !== "bundled") {
				this.catalog = { ...current, origin: remote.origin, updatedAt: remote.updatedAt || current.updatedAt };
				try {
					saveCachedCatalog(this.catalog);
				} catch {
					/* ignore */
				}
			}
			return {
				ok: true,
				updated: false,
				origin: remote.origin,
				catalog: this.catalogMeta(),
			};
		})().finally(() => {
			this.catalogRefreshPromise = null;
		});

		return this.catalogRefreshPromise;
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

	async listCatalog(options) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用", categories: [], results: [], total: 0 };
		}
		const opts = options && typeof options === "object" ? options : {};
		const mode = opts.mode === "category" || opts.mode === "all" ? opts.mode : "recommend";
		const category = typeof opts.category === "string" ? opts.category.trim() : "";
		const query = typeof opts.query === "string" ? opts.query : "";
		let installedNames = Array.isArray(opts.installedNames) ? opts.installedNames : null;
		if (!installedNames) {
			const listed = await this.listInstalled();
			installedNames = listed.ok ? listed.names : [];
		}

		// 打开推荐/分类时尝试按 TTL 拉远程；失败静默回退本地
		await this.refreshCatalog({ force: opts.refresh === true }).catch(() => {});

		const catalog = this.getCatalog();
		const personalize = mode === "recommend";
		const effectiveCategory = mode === "category" ? category || "featured" : mode === "all" ? "" : "";
		const rows = filterCatalogPlugins(catalog, {
			category: effectiveCategory,
			query,
			personalize,
			installedNames,
		});
		const results = rows.map(mapCatalogPlugin);
		return {
			ok: true,
			mode: personalize ? "recommend" : mode === "all" ? "all" : "category",
			category: effectiveCategory || null,
			updatedAt: catalog.updatedAt,
			catalogVersion: catalog.version || 0,
			catalogOrigin: catalog.origin || "bundled",
			categories: catalog.categories,
			results,
			total: results.length,
		};
	}

	async search(query, options) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用", results: [], total: 0 };
		}
		const opts = options && typeof options === "object" ? options : {};
		const q = String(query || "").trim() || "dsh";
		const source =
			opts.source === "npm" || opts.source === "github" || opts.source === "catalog"
				? opts.source
				: "all";
		const verify = opts.verify === true;

		if (source === "catalog") {
			await this.refreshCatalog({ force: false }).catch(() => {});
			const listed = await this.listInstalled();
			const catalog = this.getCatalog();
			const rows = filterCatalogPlugins(catalog, {
				category: opts.category || "",
				query: q === "dsh" ? "" : q,
				personalize: opts.personalize === true,
				installedNames: listed.ok ? listed.names : [],
			});
			const results = rows.map(mapCatalogPlugin);
			return {
				ok: true,
				cached: false,
				query: q,
				source,
				verify: false,
				results,
				total: results.length,
				catalogVersion: catalog.version || 0,
				catalogOrigin: catalog.origin || "bundled",
			};
		}

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
							enum: ["all", "npm", "github", "catalog"],
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
					name: "plugin_discovery_catalog",
					description:
						"List curated DSH plugin recommendations and categories bundled with dsh-plugin-discovery.",
					parameters: {
						mode: {
							type: "string",
							enum: ["recommend", "category", "all"],
							description: "recommend = personalized; category = filter by category; all = full catalog",
						},
						category: {
							type: "string",
							description: "Category id when mode=category (pet, theme, im, memory, ...)",
						},
					},
					output: toolOutput,
					async execute(args) {
						return service.listCatalog({
							mode: args.mode || "recommend",
							category: args.category || "",
						});
					},
					presentCall: (_args, partial) =>
						present(`DSH plugin catalog: ${partial?.mode || "recommend"}`),
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
markRemoteMethod(PluginDiscoveryService.prototype, "listCatalog");
markRemoteMethod(PluginDiscoveryService.prototype, "resolve");
markRemoteMethod(PluginDiscoveryService.prototype, "installPlugin");
markRemoteMethod(PluginDiscoveryService.prototype, "listInstalled");
markRemoteMethod(PluginDiscoveryService.prototype, "waitInstall");

export default PluginDiscoveryService;
