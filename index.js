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
const SELF_PACKAGE_NAME = "dsh-plugin-discovery";
const DEFAULT_SELF_PACKAGE_GITEE_URL =
	"https://gitee.com/hjhcos/dsh-plugin-discovery/raw/main/package.json";
const DEFAULT_SELF_PACKAGE_GITHUB_URL =
	"https://raw.githubusercontent.com/hjhcos/dsh-plugin-discovery/main/package.json";

function readLocalPackageMeta() {
	try {
		const raw = readFileSync(join(__dirname, "package.json"), "utf8");
		const data = JSON.parse(raw);
		return {
			name: data.name || SELF_PACKAGE_NAME,
			version: String(data.version || "0.0.0"),
		};
	} catch {
		return { name: SELF_PACKAGE_NAME, version: "0.0.0" };
	}
}

function parseSemverParts(version) {
	const cleaned = String(version || "0")
		.trim()
		.replace(/^v/i, "")
		.split("-")[0]
		.split("+")[0];
	return cleaned.split(".").map((part) => {
		const n = Number.parseInt(part, 10);
		return Number.isFinite(n) ? n : 0;
	});
}

/** @returns {number} 1 if a>b, -1 if a<b, 0 if equal */
function compareSemver(a, b) {
	const pa = parseSemverParts(a);
	const pb = parseSemverParts(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i += 1) {
		const x = pa[i] || 0;
		const y = pb[i] || 0;
		if (x > y) return 1;
		if (x < y) return -1;
	}
	return 0;
}

async function fetchJsonWithTimeout(url, timeoutMs = 12000) {
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
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return await response.json();
	} finally {
		clearTimeout(timer);
	}
}

async function fetchLatestSelfVersion(urls) {
	const errors = [];
	for (const entry of urls) {
		try {
			if (entry.kind === "npm") {
				const data = await fetchJsonWithTimeout(entry.url);
				const version = data?.version || data?.["dist-tags"]?.latest;
				if (version) return { version: String(version), origin: "npm", url: entry.url };
			} else {
				const data = await fetchJsonWithTimeout(entry.url);
				const version = data?.version;
				if (version) return { version: String(version), origin: entry.label || "remote", url: entry.url };
			}
		} catch (error) {
			errors.push(`${entry.label || entry.kind}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return { version: null, origin: null, url: null, error: errors.join("; ") || "latest version unavailable" };
}

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

/** 在线搜索时把精选目录命中置顶，避免同名冷门包（如 @dsh-ssh/dsh-ssh）盖过已验证的 @linxin666/dsh-ssh。 */
function catalogHitsForQuery(catalog, query, limit) {
	const rows = filterCatalogPlugins(catalog, {
		category: "",
		query,
		personalize: false,
		installedNames: [],
	});
	return rows.slice(0, Math.max(0, limit)).map((row) => ({
		...mapCatalogPlugin(row),
		reason: "catalog",
	}));
}

function suggestCatalogAlternatives(catalog, failedSpec, limit = 3) {
	const failed = String(failedSpec || "").trim().toLowerCase();
	if (!failed) return [];
	const tokens = failed
		.replace(/^@/, "")
		.split(/[/@._-]+/)
		.map((part) => part.trim().toLowerCase())
		.filter((part) => part.length >= 3 && part !== "dsh" && part !== "plugin");
	const uniq = [];
	const seen = new Set([failed]);
	for (const token of tokens.length ? tokens : [failed]) {
		for (const row of catalogHitsForQuery(catalog, token, 8)) {
			const spec = String(row.spec || "").trim();
			if (!spec || seen.has(spec.toLowerCase())) continue;
			seen.add(spec.toLowerCase());
			uniq.push(spec);
			if (uniq.length >= limit) return uniq;
		}
	}
	return uniq;
}

/** ManagementError 没有 message 字段，只有 code / diagnostic；再拼上 packageResult 输出尾部。 */
function formatChangeFailure(result, fallbackApplication = "failed") {
	const parts = [];
	const err = result?.error;
	if (err && typeof err === "object") {
		if (err.diagnostic) parts.push(String(err.diagnostic).trim());
		if (err.code) parts.push(`错误码：${err.code}`);
		if (Array.isArray(err.incompatible) && err.incompatible.length) {
			const names = err.incompatible
				.map((row) => `${row?.name || "?"}@${row?.version || "?"}`)
				.filter(Boolean);
			if (names.length) parts.push(`不兼容：${names.join("、")}`);
		}
	} else if (typeof err === "string" && err.trim()) {
		parts.push(err.trim());
	} else if (err?.message) {
		parts.push(String(err.message).trim());
	}

	const pkg = result?.packageResult;
	if (pkg && typeof pkg === "object") {
		if (pkg.kind) parts.push(`失败类型：${pkg.kind}`);
		if (pkg.timedOut) parts.push("安装超时（长时间无输出）");
		if (typeof pkg.exitCode === "number") parts.push(`退出码：${pkg.exitCode}`);
		const output = String(pkg.output || "").trim();
		if (output) {
			const lines = output
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean);
			const tail = lines.slice(-8).join("\n");
			if (tail) parts.push(tail);
		}
		if (pkg.logPath) parts.push(`完整日志：${pkg.logPath}`);
	}

	if (result?.failedAt) parts.push(`失败位置：${result.failedAt}`);
	if (Array.isArray(result?.pendingBuilds) && result.pendingBuilds.length) {
		parts.push(`待批准构建脚本：${result.pendingBuilds.join("、")}`);
	}
	if (Array.isArray(result?.warnings) && result.warnings.length) {
		parts.push(`警告：${result.warnings.slice(0, 3).join("；")}`);
	}

	const unique = [];
	const seen = new Set();
	for (const part of parts) {
		const text = String(part || "").trim();
		if (!text || seen.has(text)) continue;
		seen.add(text);
		unique.push(text);
	}
	if (unique.length) return unique.join("\n");
	const application = result?.application || fallbackApplication;
	return `安装失败（${application}）。插件管理器未返回 diagnostic / 安装日志。`;
}

function extractIncompatibility(result) {
	const code = result?.error?.code || null;
	const incompatible = Array.isArray(result?.error?.incompatible)
		? result.error.incompatible
				.map((row) => ({
					name: String(row?.name || "").trim(),
					version: String(row?.version || "").trim(),
					runtimeVersion: String(row?.runtimeVersion || "").trim(),
					peers: row?.peers && typeof row.peers === "object" ? row.peers : {},
				}))
				.filter((row) => row.name && row.version)
		: [];
	return {
		code,
		incompatible,
		needsRiskExemption: code === "incompatible-version" && incompatible.length > 0,
	};
}

/** 安装失败时从精选目录推荐相近/同标签插件，优先给出可替代的当前生态包。 */
function buildFailureRecommendations(catalog, failedSpec, limit = 4) {
	const failed = String(failedSpec || "").trim();
	const seen = new Set([failed.toLowerCase()]);
	const out = [];
	const pushRow = (row, reason) => {
		const spec = String(row?.spec || "").trim();
		if (!spec || seen.has(spec.toLowerCase())) return;
		seen.add(spec.toLowerCase());
		out.push({
			spec,
			title: row.title || spec,
			description: row.description || "",
			source: "catalog",
			installSpec: spec,
			catalogId: row.id || row.spec,
			reason: reason || "similar",
			featured: row.featured === true,
			rank: typeof row.rank === "number" ? row.rank : 0,
		});
	};

	const plugins = Array.isArray(catalog?.plugins) ? catalog.plugins : [];
	const failedRow = plugins.find((row) => String(row.spec || "").toLowerCase() === failed.toLowerCase());
	if (failedRow) {
		for (const rel of failedRow.related || []) {
			const hit = plugins.find((row) => String(row.spec || "") === rel || String(row.id || "") === rel);
			if (hit) pushRow(hit, "related");
			if (out.length >= limit) return out;
		}
		for (const tag of failedRow.tags || []) {
			for (const row of plugins) {
				if ((row.tags || []).includes(tag)) pushRow(row, "tag");
				if (out.length >= limit) return out;
			}
		}
		for (const cat of failedRow.categories || []) {
			if (cat === "featured") continue;
			for (const row of plugins) {
				if ((row.categories || []).includes(cat)) pushRow(row, "category");
				if (out.length >= limit) return out;
			}
		}
	}

	for (const spec of suggestCatalogAlternatives(catalog, failed, limit)) {
		const hit = plugins.find((row) => String(row.spec || "") === spec) || { spec, title: spec };
		pushRow(hit, "similar");
		if (out.length >= limit) break;
	}
	return out.slice(0, limit);
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
		/** 启动与打开面板时检查本插件是否有新版本 */
		selfUpdateCheckEnabled: z.boolean().default(true),
		/** 发现新版本后自动执行更新（file: 本地开发安装会跳过自动更新） */
		selfUpdateAuto: z.boolean().default(true),
		selfUpdateCheckTtlMs: z.number().min(0).max(86400000 * 7).default(21600000),
		selfPackageName: z.string().default(SELF_PACKAGE_NAME),
		selfPackageGiteeUrl: z.string().default(DEFAULT_SELF_PACKAGE_GITEE_URL),
		selfPackageGithubUrl: z.string().default(DEFAULT_SELF_PACKAGE_GITHUB_URL),
	});

	constructor(ctx, config) {
		super(ctx, "pluginDiscovery");
		this.config = config;
		this.cache = new Map();
		this.catalog = pickNewerCatalog(loadBundledCatalog(), loadCachedCatalog());
		this.catalogCheckedAt = 0;
		this.catalogRefreshPromise = null;
		this.selfUpdateCheckedAt = 0;
		this.selfUpdateState = null;
		this.selfUpdatePromise = null;
		this.ctx.effect(() => this.registerTools());
		// 启动后后台拉一次，不阻塞启动
		this.ctx.effect(() => {
			void this.refreshCatalog({ force: false }).catch(() => {});
			void this.checkSelfUpdate({ force: false, auto: this.config.selfUpdateAuto === true }).catch(() => {});
			return () => {};
		});
	}

	getLocalInstallMeta() {
		const local = readLocalPackageMeta();
		const real = (() => {
			try {
				return join(__dirname);
			} catch {
				return "";
			}
		})();
		const isFileInstall = /[\\/]bundles[\\/]dsh-plugin-discovery$/i.test(real.replace(/\\/g, "/"));
		return {
			name: this.config.selfPackageName || local.name || SELF_PACKAGE_NAME,
			version: local.version,
			isFileInstall,
		};
	}

	selfUpdateSourceUrls() {
		const name = this.config.selfPackageName || SELF_PACKAGE_NAME;
		const urls = [
			{
				kind: "npm",
				label: "npm",
				url: `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
			},
		];
		const gitee = String(this.config.selfPackageGiteeUrl || "").trim();
		const github = String(this.config.selfPackageGithubUrl || "").trim();
		if (gitee) urls.push({ kind: "json", label: "gitee", url: gitee });
		if (github) urls.push({ kind: "json", label: "github", url: github });
		return urls;
	}

	async resolveInstalledSelfVersion() {
		const local = this.getLocalInstallMeta();
		try {
			const bundles = await this.ctx.pluginManager.listBundles();
			const row = (Array.isArray(bundles) ? bundles : []).find((item) => item && item.name === local.name);
			if (row?.version) {
				return { currentVersion: String(row.version), source: "bundle", isFileInstall: local.isFileInstall, name: local.name };
			}
		} catch {
			/* ignore */
		}
		return {
			currentVersion: local.version,
			source: "package",
			isFileInstall: local.isFileInstall,
			name: local.name,
		};
	}

	async checkSelfUpdate(options = {}) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用" };
		}
		if (this.config.selfUpdateCheckEnabled === false) {
			return { ok: true, skipped: true, reason: "check disabled", update: this.selfUpdateState };
		}
		const force = options.force === true;
		const auto = options.auto === true;
		const ttl = this.config.selfUpdateCheckTtlMs ?? 21600000;
		if (!force && this.selfUpdateCheckedAt && Date.now() - this.selfUpdateCheckedAt < ttl && this.selfUpdateState) {
			if (auto && this.selfUpdateState.updateAvailable && !this.selfUpdateState.isFileInstall) {
				return this.updateSelf({ latestVersion: this.selfUpdateState.latestVersion });
			}
			return { ok: true, skipped: true, reason: "ttl", update: this.selfUpdateState };
		}
		if (this.selfUpdatePromise) return this.selfUpdatePromise;

		this.selfUpdatePromise = (async () => {
			const installed = await this.resolveInstalledSelfVersion();
			const latestInfo = await fetchLatestSelfVersion(this.selfUpdateSourceUrls());
			this.selfUpdateCheckedAt = Date.now();
			if (!latestInfo.version) {
				this.selfUpdateState = {
					...installed,
					latestVersion: null,
					updateAvailable: false,
					origin: null,
					checkedAt: this.selfUpdateCheckedAt,
					error: latestInfo.error,
				};
				return { ok: false, message: latestInfo.error || "无法获取最新版本", update: this.selfUpdateState };
			}
			const updateAvailable = compareSemver(latestInfo.version, installed.currentVersion) > 0;
			this.selfUpdateState = {
				name: installed.name,
				currentVersion: installed.currentVersion,
				latestVersion: latestInfo.version,
				updateAvailable,
				origin: latestInfo.origin,
				isFileInstall: installed.isFileInstall,
				checkedAt: this.selfUpdateCheckedAt,
			};
			if (auto && updateAvailable && !installed.isFileInstall && this.config.selfUpdateAuto !== false) {
				const updated = await this.updateSelf({ latestVersion: latestInfo.version });
				return { ...updated, update: this.selfUpdateState };
			}
			return {
				ok: true,
				update: this.selfUpdateState,
				message: updateAvailable
					? `发现新版本 ${latestInfo.version}（当前 ${installed.currentVersion}）`
					: `已是最新版本 ${installed.currentVersion}`,
			};
		})().finally(() => {
			this.selfUpdatePromise = null;
		});

		return this.selfUpdatePromise;
	}

	async updateSelf(options = {}) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用" };
		}
		const installed = await this.resolveInstalledSelfVersion();
		if (installed.isFileInstall) {
			return {
				ok: false,
				skipped: true,
				message: "当前为本地 file: 开发安装，已跳过自动更新。发布版用户会从 npm 升级。",
				update: this.selfUpdateState,
			};
		}
		let latestVersion = typeof options.latestVersion === "string" ? options.latestVersion.trim() : "";
		if (!latestVersion) {
			const checked = await this.checkSelfUpdate({ force: true, auto: false });
			latestVersion = checked?.update?.latestVersion || "";
			if (!checked?.update?.updateAvailable) {
				return {
					ok: true,
					updated: false,
					message: checked?.message || "没有可更新版本",
					update: checked?.update || this.selfUpdateState,
				};
			}
		}
		const name = installed.name || SELF_PACKAGE_NAME;
		const spec = `${name}@${latestVersion}`;
		const requestId =
			globalThis.crypto?.randomUUID?.() || `pd-self-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		try {
			const result = await this.ctx.pluginManager.installBundle(spec, {
				requestId,
				enabled: true,
			});
			const application = result?.application;
			const failed = application === "failed" || application === "cancelled";
			if (!failed) {
				this.selfUpdateState = {
					...(this.selfUpdateState || {}),
					name,
					currentVersion: latestVersion,
					latestVersion,
					updateAvailable: false,
					origin: this.selfUpdateState?.origin || "npm",
					isFileInstall: false,
					checkedAt: Date.now(),
				};
			}
			return {
				ok: !failed,
				updated: !failed,
				spec,
				requestId,
				application,
				packageName: name,
				version: latestVersion,
				message: failed
					? result?.error?.message || `更新失败（${application || "unknown"}）`
					: `已更新到 ${latestVersion}，请刷新页面或重启 dsh web 使界面生效`,
				update: this.selfUpdateState,
				result,
			};
		} catch (error) {
			return {
				ok: false,
				updated: false,
				spec,
				requestId,
				message: error instanceof Error ? error.message : String(error),
				update: this.selfUpdateState,
			};
		}
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
		const selfUpdate = await this.checkSelfUpdate({
			force: opts.refresh === true,
			auto: this.config.selfUpdateAuto === true,
		}).catch((error) => ({
			ok: false,
			message: error instanceof Error ? error.message : String(error),
			update: this.selfUpdateState,
		}));

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
			selfUpdate: selfUpdate?.update || this.selfUpdateState,
			selfUpdateMessage: selfUpdate?.message || null,
			selfUpdated: selfUpdate?.updated === true,
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
		await this.refreshCatalog({ force: false }).catch(() => {});
		const catalog = this.getCatalog();
		const catalogHits = catalogHitsForQuery(catalog, q === "dsh" ? "" : q, limit);
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
			if (!catalogHits.length) {
				return {
					ok: false,
					message: error instanceof Error ? error.message : String(error),
					results: [],
					total: 0,
				};
			}
			// 在线源失败时仍返回精选命中，避免「搜得到却全空」
			raw = [];
		}

		const seen = new Set();
		const deduped = [];
		for (const row of [...catalogHits, ...raw]) {
			if (!row.spec || seen.has(row.spec)) continue;
			seen.add(row.spec);
			deduped.push({
				...row,
				installSpec: row.spec,
				bundle: row.bundle ?? null,
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
		const withInstallHint = (message) => {
			const text = String(message || "").trim() || "安装失败";
			const looksNetwork =
				/ERR_PNPM_META_FETCH_FAIL|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|network|镜像/i.test(text);
			if (!looksNetwork) return text;
			const alts = suggestCatalogAlternatives(this.getCatalog(), trimmed);
			if (!alts.length) {
				return `${text}。若持续失败，可改用「分类浏览 / 为你推荐」里的精选包，或稍后重试。`;
			}
			return `${text}。可改试精选目录中的相近插件：${alts.join("、")}`;
		};
		try {
			const result = await this.ctx.pluginManager.installBundle(trimmed, {
				requestId,
				enabled: true,
			});
			const packageName = result?.bundle || pre.name || trimmed;
			const application = result?.application;
			const failed = application === "failed" || application === "cancelled";
			const rawMessage = failed
				? formatChangeFailure(result, application || "failed")
				: `「${packageName}」安装完成（${application || "applied"} / ${result?.stage || "install"}）`;
			const incompat = failed ? extractIncompatibility(result) : {};
			const recommendations =
				failed && (incompat.needsRiskExemption || incompat.code === "incompatible-version")
					? buildFailureRecommendations(this.getCatalog(), trimmed, 4)
					: undefined;
			let message = failed ? withInstallHint(rawMessage) : rawMessage;
			if (failed && recommendations && recommendations.length) {
				message = `${message}\n推荐改试：${recommendations.map((row) => row.spec).join("、")}`;
			}
			return {
				ok: !failed,
				alreadyInstalled: false,
				packageName,
				requestId,
				application,
				stage: result?.stage,
				message,
				detail: failed ? rawMessage : undefined,
				logPath: failed ? result?.packageResult?.logPath : undefined,
				code: incompat.code || undefined,
				incompatible: incompat.incompatible || undefined,
				needsRiskExemption: incompat.needsRiskExemption === true,
				recommendations,
				installSpec: trimmed,
				result,
			};
		} catch (error) {
			return {
				ok: false,
				requestId,
				message: withInstallHint(error instanceof Error ? error.message : String(error)),
				installSpec: trimmed,
			};
		}
	}

	/** Typert Remote：参数必须是独立形参，不能解构、不能默认值、不能 rest。 */
	async grantVersionExemption(packageVersion, runtimeVersion, acceptRisk) {
		if (!this.config.enabled) {
			return { ok: false, message: "发现插件已停用" };
		}
		const pkg = String(packageVersion == null ? "" : packageVersion).trim();
		const runtime = String(runtimeVersion == null ? "" : runtimeVersion).trim();
		const accepted = acceptRisk === true;
		if (!pkg || !runtime) {
			return { ok: false, message: "缺少 packageVersion 或 runtimeVersion" };
		}
		if (!accepted) {
			return {
				ok: false,
				message: "未确认风险。授予版本豁免必须 acceptRisk=true，并先明确告知可能崩溃或数据丢失。",
			};
		}
		if (typeof this.ctx.pluginManager?.setVersionExemption !== "function") {
			return { ok: false, message: "当前 DSH 不支持 setVersionExemption" };
		}
		try {
			const result = await this.ctx.pluginManager.setVersionExemption(pkg, runtime, true, true);
			const application = result?.application;
			const failed = application === "failed" || application === "cancelled";
			return {
				ok: !failed,
				packageVersion: pkg,
				runtimeVersion: runtime,
				application,
				message: failed
					? formatChangeFailure(result, application || "failed")
					: `已为 ${pkg} 在 DSH ${runtime} 上授予精确版本豁免，可重新安装。`,
				result,
			};
		} catch (error) {
			return {
				ok: false,
				packageVersion: pkg,
				runtimeVersion: runtime,
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
			const failText = failed ? formatChangeFailure(settled, settled.application) : "";
			const incompat = failed ? extractIncompatibility(settled) : {};
			const failedSpec =
				(Array.isArray(incompat.incompatible) && incompat.incompatible[0]
					? `${incompat.incompatible[0].name}@${incompat.incompatible[0].version}`
					: "") || settled.bundle || "";
			const recommendations =
				failed && (incompat.needsRiskExemption || incompat.code === "incompatible-version")
					? buildFailureRecommendations(this.getCatalog(), failedSpec, 4)
					: undefined;
			let message = failed
				? failText
				: `安装完成（${settled.application} / ${settled.stage}）`;
			if (failed && recommendations && recommendations.length) {
				message = `${message}\n推荐改试：${recommendations.map((row) => row.spec).join("、")}`;
			}
			return {
				ok: !failed,
				settled,
				pending: false,
				packageName: settled.bundle,
				application: settled.application,
				stage: settled.stage,
				message,
				detail: failed ? failText : undefined,
				logPath: failed ? settled?.packageResult?.logPath : undefined,
				code: incompat.code || undefined,
				incompatible: incompat.incompatible || undefined,
				needsRiskExemption: incompat.needsRiskExemption === true,
				recommendations,
				installSpec: failedSpec || undefined,
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
		disposers.push(
			this.ctx.tools.register(
				defineTool({
					name: "plugin_discovery_check_update",
					description: "Check whether dsh-plugin-discovery has a newer npm/Gitee version and optionally update.",
					parameters: {
						autoUpdate: {
							type: "boolean",
							description: "If true and a newer version exists, install it now",
						},
					},
					output: toolOutput,
					async execute(args) {
						return service.checkSelfUpdate({
							force: true,
							auto: args.autoUpdate === true,
						});
					},
					presentCall: () => present("Check dsh-plugin-discovery update"),
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
markRemoteMethod(PluginDiscoveryService.prototype, "checkSelfUpdate");
markRemoteMethod(PluginDiscoveryService.prototype, "updateSelf");
markRemoteMethod(PluginDiscoveryService.prototype, "resolve");
markRemoteMethod(PluginDiscoveryService.prototype, "installPlugin");
markRemoteMethod(PluginDiscoveryService.prototype, "grantVersionExemption");
markRemoteMethod(PluginDiscoveryService.prototype, "listInstalled");
markRemoteMethod(PluginDiscoveryService.prototype, "waitInstall");

export default PluginDiscoveryService;
