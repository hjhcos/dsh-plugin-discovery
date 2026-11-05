window.__ModuleLoader__.load({
	id: "dsh-plugin-discovery",
	factory(require) {
		const React = require("react");
		const h = React.createElement;
		const NS = "pluginDiscoveryUi";
		const PANEL_ID = "plugin-discovery";
		const PAGE_SIZE = 8;
		const DEFAULT_QUERY = "dsh-pet";

		const zh = {
			panel: "发现插件",
			intro: "社区插件非 DeepSeek 官方维护，安装前请自行审阅仓库与权限。",
			searchPlaceholder: "搜索关键词，例如：网采、壁纸、dsh",
			search: "搜索",
			searching: "正在加载…",
			searchCardTitle: "关键词搜索",
			searchCardDesc: "按关键词浏览社区候选；安装前会校验是否为 DSH Bundle。",
			sourceAll: "全部",
			sourceNpm: "npm",
			sourceGithub: "GitHub",
			noResults: "未找到相关插件，试试换个关键词。",
			browseHint: "浏览社区候选包；安装前会自动校验是否为 DSH Bundle。",
			install: "安装",
			installing: "安装中…",
			installedBadge: "已安装",
			installingBadge: "安装中",
			notInstalledBadge: "未安装",
			alreadyInstalled: "已安装",
			open: "打开",
			inspectFailed: "无法校验或不是 DSH Bundle",
			resolvePlaceholder: "粘贴完整链接，如 https://github.com/user/repo",
			resolve: "解析安装",
			resolveCardTitle: "链接安装",
			resolveCardDesc: "粘贴已知 npm / GitHub 地址直接解析安装；关键词请用上方搜索。",
			resolveHint: "下方仅用于安装已知仓库；关键词请点上方「搜索」",
			pagePrev: "上一页",
			pageNext: "下一页",
			pageStatus: "第 {page} / {pages} 页 · 共 {total} 项",
			sourceNpmBadge: "npm",
			sourceGithubBadge: "GitHub",
			sourceCatalogBadge: "精选",
			stars: "{n} stars",
			emptyTitle: "还没有列表",
			loadFailed: "加载失败",
			installed: "安装完成，请到「插件」页查看。",
			installProgress: "正在安装 {spec}…",
			installPhase: "安装进度：{phase}",
			installLog: "安装输出：{text}",
			installFailed: "安装失败",
			retry: "重试",
			browseRecommend: "为你推荐",
			browseCategory: "分类浏览",
			browseSearch: "在线搜索",
			recommendCardTitle: "个性化推荐",
			recommendCardDesc: "根据你已安装的插件偏好，从精选目录排序推荐；目录可从 Gitee 自动更新。",
			categoryCardTitle: "按分类浏览",
			categoryCardDesc: "市面常用 DSH 插件收录在 JSON 目录中，优先从 Gitee 拉取最新版。",
			categoryAll: "全部精选",
			catalogMeta: "目录 v{version} · 来源 {origin}",
			catalogOriginBundled: "插件内置",
			catalogOriginCache: "本地缓存",
			catalogOriginGitee: "Gitee",
			catalogOriginGithub: "GitHub",
			catalogOriginRemote: "远程",
			refreshCatalog: "刷新目录",
			reasonFeatured: "精选",
			reasonRelated: "与已装相关",
			reasonPopular: "热门",
			reasonPet: "桌宠爱好者",
			reasonTheme: "主题爱好者",
			reasonIm: "IM 通道",
			reasonMemory: "记忆相关",
			reasonProductivity: "效率相关",
			reasonMedia: "多媒体",
			reasonRemote: "远程相关",
			reasonMarketplace: "市场相关",
			reasonAgent: "智能体相关",
		};
		const en = {
			panel: "Discover",
			intro: "Community plugins are not official; review the repo before installing.",
			searchPlaceholder: "Keywords, e.g. scraping, wallpaper, dsh",
			search: "Search",
			searching: "Loading…",
			searchCardTitle: "Keyword search",
			searchCardDesc: "Browse community candidates; install verifies DSH Bundle metadata.",
			sourceAll: "All",
			sourceNpm: "npm",
			sourceGithub: "GitHub",
			noResults: "No plugins matched. Try another keyword.",
			browseHint: "Browse community packages; install verifies DSH Bundle metadata.",
			install: "Install",
			installing: "Installing…",
			installedBadge: "Installed",
			installingBadge: "Installing",
			notInstalledBadge: "Not installed",
			alreadyInstalled: "Installed",
			open: "Open",
			inspectFailed: "Not a DSH Bundle or inspect failed",
			resolvePlaceholder: "Paste full URL, e.g. https://github.com/user/repo",
			resolve: "Install",
			resolveCardTitle: "Install from link",
			resolveCardDesc: "Paste a known npm / GitHub URL to resolve and install.",
			resolveHint: "Bottom row installs a known repo; use Search above for keywords",
			pagePrev: "Previous",
			pageNext: "Next",
			pageStatus: "Page {page} / {pages} · {total} items",
			sourceNpmBadge: "npm",
			sourceGithubBadge: "GitHub",
			sourceCatalogBadge: "Curated",
			stars: "{n} stars",
			emptyTitle: "Nothing here yet",
			loadFailed: "Failed to load",
			installed: "Install finished. Check the Plugins panel.",
			installProgress: "Installing {spec}…",
			installPhase: "Progress: {phase}",
			installLog: "Output: {text}",
			installFailed: "Install failed",
			retry: "Retry",
			browseRecommend: "For you",
			browseCategory: "Categories",
			browseSearch: "Online search",
			recommendCardTitle: "Personalized picks",
			recommendCardDesc: "Ranked from the curated catalog; auto-updates from Gitee when possible.",
			categoryCardTitle: "Browse by category",
			categoryCardDesc: "Common DSH plugins live in a JSON catalog, preferring Gitee for updates.",
			categoryAll: "All featured",
			catalogMeta: "Catalog v{version} · {origin}",
			catalogOriginBundled: "bundled",
			catalogOriginCache: "local cache",
			catalogOriginGitee: "Gitee",
			catalogOriginGithub: "GitHub",
			catalogOriginRemote: "remote",
			refreshCatalog: "Refresh catalog",
			reasonFeatured: "Featured",
			reasonRelated: "Related to installed",
			reasonPopular: "Popular",
			reasonPet: "Pets fans",
			reasonTheme: "Theme fans",
			reasonIm: "Messaging",
			reasonMemory: "Memory",
			reasonProductivity: "Productivity",
			reasonMedia: "Media",
			reasonRemote: "Remote",
			reasonMarketplace: "Marketplace",
			reasonAgent: "Agents",
		};

		function format(template, vars) {
			return String(template).replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? "" : String(vars[key])));
		}

		function candidateKeys(item) {
			// 仅保留精确标识，不把 @scope/name 拆成短名，避免 dsh-pet 与 @linxin666/dsh-pet 状态串线
			const keys = [];
			const push = (value) => {
				if (!value) return;
				const text = String(value).trim();
				if (!text || keys.includes(text)) return;
				keys.push(text);
				const bare = text.replace(/^github:/i, "");
				if (bare !== text && !keys.includes(bare)) keys.push(bare);
			};
			push(item.spec);
			push(item.installSpec);
			push(item.title);
			push(item.name);
			push(item.packageName);
			return keys;
		}

		function isInstalledItem(item, installedNames) {
			if (!installedNames || !installedNames.size) return false;
			return candidateKeys(item).some((key) => installedNames.has(key));
		}

		const INSTALLED_CACHE_KEY = "dsh.pluginDiscovery.installedNames";
		const JOB_CACHE_KEY = "dsh.pluginDiscovery.installJobs";

		function readInstalledCache() {
			try {
				const raw = window.localStorage.getItem(INSTALLED_CACHE_KEY);
				const list = raw ? JSON.parse(raw) : [];
				return new Set(Array.isArray(list) ? list.filter(Boolean) : []);
			} catch {
				return new Set();
			}
		}

		function writeInstalledCache(names) {
			try {
				window.localStorage.setItem(INSTALLED_CACHE_KEY, JSON.stringify([...names]));
			} catch {
				/* ignore */
			}
		}

		function readJobCache() {
			try {
				const raw = window.localStorage.getItem(JOB_CACHE_KEY);
				const obj = raw ? JSON.parse(raw) : {};
				return obj && typeof obj === "object" ? obj : {};
			} catch {
				return {};
			}
		}

		function writeJobCache(jobs) {
			try {
				window.localStorage.setItem(JOB_CACHE_KEY, JSON.stringify(jobs));
			} catch {
				/* ignore */
			}
		}

		function newRequestId() {
			return globalThis.crypto?.randomUUID?.() || `pd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		}

		function jobMatchesItem(job, item) {
			if (!job) return false;
			const keys = new Set([...(job.keys || []), job.spec, job.packageName].filter(Boolean));
			return candidateKeys(item).some((key) => keys.has(key));
		}

		function resolveItemStatus(item, installedNames, jobs) {
			if (isInstalledItem(item, installedNames)) return { status: "installed", job: null };
			const job = Object.values(jobs || {}).find((row) => jobMatchesItem(row, item));
			if (job && job.status === "installing") return { status: "installing", job };
			if (job && job.status === "failed") return { status: "failed", job };
			return { status: "none", job: null };
		}

		function identitySchema() {
			return {
				parse(value) {
					return value;
				},
			};
		}

		function strictJson(typeSymbol) {
			return {
				mode: "strict",
				typeSymbol,
				create: identitySchema,
			};
		}

		function PanelIcon(props) {
			const size = props.size ?? 18;
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.8",
					"aria-hidden": "true",
				},
				h("circle", { cx: "11", cy: "11", r: "7" }),
				h("path", { d: "M20 20l-3.5-3.5" }),
				h("path", { d: "M8 11h6M11 8v6" }),
			);
		}

		const styles = {
			page: {
				boxSizing: "border-box",
				height: "100%",
				fontFamily: "var(--dsw-font-family)",
				color: "var(--dsw-alias-label-primary)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "24px",
				padding: "0 clamp(24px, 4vw, 48px) 48px",
				overflow: "auto",
			},
			inner: {
				width: "100%",
				maxWidth: "960px",
				display: "flex",
				flexDirection: "column",
				gap: "16px",
			},
			head: {
				paddingTop: "28px",
				display: "flex",
				flexDirection: "column",
				gap: "4px",
			},
			title: {
				margin: 0,
				fontFamily: "var(--dsw-font-family)",
				fontSize: "20px",
				fontWeight: 500,
				lineHeight: "28px",
				color: "var(--dsw-alias-label-primary)",
			},
			intro: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "13px",
				lineHeight: "20px",
			},
			card: {
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				padding: "16px 18px",
				borderRadius: "var(--dsw-radius-md, 12px)",
				border: "1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l4, #d8dde6))",
				background: "var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-1, #f5f6f7))",
				boxShadow: "var(--dsw-elevation-soft, var(--dsw-shadow-lv1, 0 2px 8px rgba(0,0,0,0.04)))",
			},
			cardHead: {
				display: "flex",
				flexDirection: "column",
				gap: "2px",
			},
			cardTitle: {
				margin: 0,
				fontSize: "14px",
				fontWeight: 500,
				lineHeight: "22px",
				color: "var(--dsw-alias-label-primary)",
			},
			cardDesc: {
				margin: 0,
				fontSize: "12px",
				fontWeight: 400,
				lineHeight: "18px",
				color: "var(--dsw-alias-label-tertiary)",
			},
			toolbar: {
				display: "flex",
				flexWrap: "wrap",
				gap: "10px",
				alignItems: "center",
			},
			browseTabs: {
				display: "flex",
				flexWrap: "wrap",
				gap: "8px",
				alignItems: "center",
			},
			chips: {
				display: "flex",
				flexWrap: "wrap",
				gap: "8px",
				alignItems: "center",
			},
			chip: {
				display: "inline-flex",
				alignItems: "center",
				height: "28px",
				padding: "0 12px",
				borderRadius: "var(--dsw-radius-sm, 8px)",
				border: "1px solid var(--dsw-alias-border-l2, #d8dde6)",
				background: "var(--dsw-alias-bg-base, #ffffff)",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "12px",
				fontWeight: 500,
				lineHeight: "18px",
				cursor: "pointer",
				fontFamily: "var(--dsw-font-family)",
			},
			chipActive: {
				borderColor: "var(--dsw-alias-state-business-primary, #4176e6)",
				background: "color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 12%, transparent)",
				color: "var(--dsw-alias-state-business-primary, #4176e6)",
			},
			searchGrow: {
				flex: "1 1 240px",
				minWidth: "200px",
			},
			field: {
				boxSizing: "border-box",
				width: "100%",
				height: "40px",
				padding: "0 14px",
				borderRadius: "var(--dsw-radius-sm, 8px)",
				border: "1px solid var(--dsw-alias-border-l1, var(--dsw-alias-border-l2, #c8ced6))",
				background: "var(--dsw-alias-bg-base, #ffffff)",
				color: "var(--dsw-alias-label-primary)",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "14px",
				lineHeight: "22px",
				outline: "none",
				boxShadow: "inset 0 1px 2px rgba(16, 24, 40, 0.04)",
			},
			btn: {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				height: "40px",
				padding: "0 16px",
				borderRadius: "var(--dsw-radius-sm, 8px)",
				border: "1px solid transparent",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "14px",
				fontWeight: 500,
				lineHeight: "22px",
				cursor: "pointer",
				whiteSpace: "nowrap",
			},
			btnPrimary: {
				background: "var(--dsw-alias-state-business-primary, var(--dsw-static-deepseek-500, #4176e6))",
				color: "#ffffff",
			},
			btnOutline: {
				background: "var(--dsw-alias-bg-base, #ffffff)",
				borderColor: "var(--dsw-alias-border-l1, #c8ced6)",
				color: "var(--dsw-alias-label-primary)",
			},
			btnSm: {
				height: "28px",
				padding: "0 10px",
				fontSize: "12px",
				lineHeight: "18px",
			},
			btnDisabled: {
				opacity: 0.45,
				cursor: "not-allowed",
			},
			seg: {
				display: "inline-flex",
				padding: "3px",
				gap: "2px",
				borderRadius: "var(--dsw-radius-sm, 8px)",
				border: "0.5px solid var(--dsw-alias-border-l2, #d0d5dd)",
				background: "var(--dsw-alias-bg-module-platform, #f5f6f7)",
			},
			segItem: {
				height: "32px",
				padding: "0 12px",
				border: "none",
				borderRadius: "6px",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				fontFamily: "var(--dsw-font-family)",
				fontSize: "13px",
				cursor: "pointer",
			},
			segItemActive: {
				background: "var(--dsw-alias-bg-layer-2, #ffffff)",
				color: "var(--dsw-alias-label-primary)",
				boxShadow: "0 0 0 0.5px var(--dsw-alias-border-l2, #d0d5dd)",
				fontWeight: 500,
			},
			list: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
			},
			row: {
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "space-between",
				gap: "16px",
				padding: "14px 16px",
				borderRadius: "var(--dsw-radius-md, 12px)",
				border: "0.5px solid var(--dsw-alias-border-l4, #e5e7eb)",
				background: "var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2, #ffffff))",
				boxShadow: "var(--dsw-shadow-lv1, 0 2px 4px 0 rgba(0,0,0,0.05))",
			},
			rowMain: {
				minWidth: 0,
				flex: "1 1 auto",
				display: "grid",
				gap: "4px",
			},
			rowTitle: {
				margin: 0,
				fontFamily: "var(--dsw-font-family)",
				fontSize: "14px",
				fontWeight: 500,
				lineHeight: "22px",
				color: "var(--dsw-alias-label-primary)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			rowDesc: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "13px",
				lineHeight: "20px",
				display: "-webkit-box",
				WebkitLineClamp: 2,
				WebkitBoxOrient: "vertical",
				overflow: "hidden",
			},
			meta: {
				display: "flex",
				flexWrap: "wrap",
				gap: "8px",
				alignItems: "center",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: "12px",
				lineHeight: "18px",
			},
			badge: {
				display: "inline-flex",
				alignItems: "center",
				padding: "0 8px",
				height: "20px",
				borderRadius: "999px",
				border: "0.5px solid var(--dsw-alias-border-l2, #d0d5dd)",
				background: "var(--dsw-alias-bg-module-platform, #f5f6f7)",
				fontSize: "11px",
				color: "var(--dsw-alias-label-secondary)",
			},
			badgeInstalled: {
				display: "inline-flex",
				alignItems: "center",
				padding: "0 8px",
				height: "20px",
				borderRadius: "999px",
				border: "0.5px solid var(--dsw-alias-state-success-primary, #4ed17e)",
				background: "var(--dsw-static-green-100, #e6faed)",
				fontSize: "11px",
				color: "var(--dsw-alias-state-success-primary, #2f9e44)",
			},
			badgeInstalling: {
				display: "inline-flex",
				alignItems: "center",
				padding: "0 8px",
				height: "20px",
				borderRadius: "999px",
				border: "0.5px solid var(--dsw-alias-state-business-primary, #4176e6)",
				background: "var(--dsw-static-blue-50, #eff6ff)",
				fontSize: "11px",
				color: "var(--dsw-alias-state-business-primary, #4176e6)",
			},
			btnInstalled: {
				background: "var(--dsw-alias-bg-module-platform, #f5f6f7)",
				borderColor: "var(--dsw-alias-border-l2, #d0d5dd)",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "default",
			},
			btnInstalling: {
				background: "var(--dsw-static-blue-50, #eff6ff)",
				borderColor: "var(--dsw-alias-state-business-primary, #4176e6)",
				color: "var(--dsw-alias-state-business-primary, #4176e6)",
				cursor: "wait",
			},
			actions: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				flex: "0 0 auto",
			},
			empty: {
				color: "var(--dsw-alias-label-tertiary)",
				margin: "40px 0",
				fontSize: "13px",
				lineHeight: "20px",
				textAlign: "center",
			},
			status: {
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "13px",
				lineHeight: "20px",
				margin: 0,
			},
			errorBox: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "12px",
				padding: "12px 14px",
				borderRadius: "var(--dsw-radius-sm, 8px)",
				border: "0.5px solid var(--dsw-alias-border-l2, #d0d5dd)",
				background: "var(--dsw-alias-settings-card-fill, #ffffff)",
				color: "var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-secondary))",
				fontSize: "13px",
			},
			pager: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "12px",
				flexWrap: "wrap",
				paddingTop: "4px",
			},
			pagerButtons: {
				display: "flex",
				gap: "8px",
			},
			link: {
				color: "var(--dsw-alias-brand-primary, var(--dsw-alias-label-secondary))",
				textDecoration: "none",
			},
		};

		function Field(props) {
			return h("input", {
				type: "text",
				style: styles.field,
				value: props.value,
				placeholder: props.placeholder,
				disabled: props.disabled,
				onChange: props.onChange,
				onKeyDown: props.onKeyDown,
			});
		}

		function Btn(props) {
			const style = Object.assign(
				{},
				styles.btn,
				props.variant === "outline"
					? styles.btnOutline
					: props.variant === "installed"
						? styles.btnInstalled
						: props.variant === "installing"
							? styles.btnInstalling
							: styles.btnPrimary,
				props.size === "sm" ? styles.btnSm : null,
				props.disabled ? styles.btnDisabled : null,
				props.style || null,
			);
			return h(
				"button",
				{
					type: "button",
					style,
					disabled: props.disabled,
					onClick: props.onClick,
				},
				props.children,
			);
		}

		function SourceSeg(props) {
			return h(
				"div",
				{ style: styles.seg, role: "group", "aria-label": "source" },
				props.options.map((opt) =>
					h(
						"button",
						{
							key: opt.value,
							type: "button",
							disabled: props.disabled,
							style: Object.assign(
								{},
								styles.segItem,
								props.value === opt.value ? styles.segItemActive : null,
								props.disabled ? styles.btnDisabled : null,
							),
							onClick: () => props.onChange(opt.value),
						},
						opt.label,
					),
				),
			);
		}

		function Chip(props) {
			return h(
				"button",
				{
					type: "button",
					disabled: props.disabled,
					style: Object.assign({}, styles.chip, props.active ? styles.chipActive : null),
					onClick: props.onClick,
				},
				props.children,
			);
		}

		function reasonLabel(t, reason) {
			const keyMap = {
				featured: "reasonFeatured",
				related: "reasonRelated",
				popular: "reasonPopular",
				pet: "reasonPet",
				theme: "reasonTheme",
				im: "reasonIm",
				memory: "reasonMemory",
				productivity: "reasonProductivity",
				media: "reasonMedia",
				remote: "reasonRemote",
				marketplace: "reasonMarketplace",
				agent: "reasonAgent",
			};
			const key = keyMap[reason] || "reasonPopular";
			return t(key);
		}

		function categoryLabel(cat, lang) {
			if (!cat) return "";
			const label = cat.label || {};
			if (lang === "en") return label.en || label.zh || cat.id;
			return label.zh || label.en || cat.id;
		}

		function unwrapRemote(result, fallbackMessage) {
			if (!result) return { ok: false, message: fallbackMessage };
			if (result.ok === false) {
				const err = result.error;
				return {
					ok: false,
					message: (err && (err.message || err.code)) || fallbackMessage,
				};
			}
			return result.value;
		}

		function Panel(props) {
			const api = props.api;
			const t = props.t;
			const lang = React.useMemo(() => {
				const sample = String(t("browseRecommend") || "");
				return /[\u4e00-\u9fff]/.test(sample) ? "zh" : "en";
			}, [t]);
			const [browseMode, setBrowseMode] = React.useState("recommend");
			const [category, setCategory] = React.useState("beginner");
			const [categories, setCategories] = React.useState([]);
			const [catalogInfo, setCatalogInfo] = React.useState({ version: 0, origin: "bundled" });
			const [query, setQuery] = React.useState(DEFAULT_QUERY);
			const [source, setSource] = React.useState("all");
			const [results, setResults] = React.useState([]);
			const [message, setMessage] = React.useState("");
			const [error, setError] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [resolveInput, setResolveInput] = React.useState("");
			const [installDetail, setInstallDetail] = React.useState("");
			const [installedNames, setInstalledNames] = React.useState(() => readInstalledCache());
			const [jobs, setJobs] = React.useState(() => readJobCache());
			const [page, setPage] = React.useState(1);
			const jobsRef = React.useRef(jobs);
			const installedNamesRef = React.useRef(installedNames);
			React.useEffect(() => {
				jobsRef.current = jobs;
				writeJobCache(jobs);
			}, [jobs]);
			React.useEffect(() => {
				installedNamesRef.current = installedNames;
			}, [installedNames]);

			const refreshInstalled = React.useCallback(async () => {
				if (!api || typeof api.listInstalled !== "function") return;
				try {
					const res = await api.listInstalled();
					if (res && res.ok && Array.isArray(res.names)) {
						// 以服务端名单为准整体覆盖，卸载后才能从「已安装」恢复为「未安装」
						const nextNames = new Set();
						for (const name of res.names) {
							if (!name) continue;
							nextNames.add(name);
						}
						writeInstalledCache(nextNames);
						setInstalledNames(nextNames);

						setJobs((prev) => {
							const next = { ...prev };
							let changed = false;
							for (const [id, job] of Object.entries(next)) {
								const keys = [job.spec, job.packageName, ...(job.keys || [])].filter(Boolean);
								const present = keys.some((key) => nextNames.has(key));
								if (present) {
									if (job.status !== "installed") {
										next[id] = { ...job, status: "installed", detail: "", updatedAt: Date.now() };
										changed = true;
									}
								} else if (job.status === "installed" || job.status === "failed") {
									// 已卸载或过期的终态任务从缓存移除
									delete next[id];
									changed = true;
								}
							}
							return changed ? next : prev;
						});
					}
				} catch {
					/* ignore */
				}
			}, [api]);

			const markInstalled = React.useCallback((name) => {
				if (!name) return;
				setInstalledNames((prev) => {
					const next = new Set(prev);
					next.add(name);
					writeInstalledCache(next);
					return next;
				});
			}, []);

			const upsertJob = React.useCallback((requestId, patch) => {
				if (!requestId) return;
				setJobs((prev) => {
					const current = prev[requestId] || { requestId, status: "installing", keys: [] };
					return {
						...prev,
						[requestId]: {
							...current,
							...patch,
							requestId,
							updatedAt: Date.now(),
						},
					};
				});
			}, []);

			const finishJob = React.useCallback(
				(requestId, outcome) => {
					if (!requestId) return;
					setJobs((prev) => {
						const current = prev[requestId];
						if (!current) return prev;
						if (outcome.status === "installed") {
							for (const key of [current.spec, current.packageName, outcome.packageName, ...(current.keys || [])]) {
								if (key) markInstalled(key);
							}
						}
						return {
							...prev,
							[requestId]: {
								...current,
								...outcome,
								updatedAt: Date.now(),
							},
						};
					});
				},
				[markInstalled],
			);

			const runCatalog = React.useCallback(
				async (mode, nextCategory) => {
					setBusy(true);
					setMessage("");
					setError("");
					try {
						if (!api || typeof api.listCatalog !== "function") {
							setResults([]);
							setError(t("loadFailed") + ": catalog unavailable");
							return;
						}
						const [res] = await Promise.all([
							api.listCatalog({
								mode: mode === "category" ? "category" : "recommend",
								category: nextCategory || "featured",
								installedNames: [...installedNamesRef.current],
								refresh: false,
							}),
							refreshInstalled(),
						]);
						if (!res || !res.ok) {
							setResults([]);
							setError((res && res.message) || t("loadFailed"));
						} else {
							if (Array.isArray(res.categories) && res.categories.length) {
								setCategories(res.categories);
							}
							setCatalogInfo({
								version: res.catalogVersion || 0,
								origin: res.catalogOrigin || "bundled",
							});
							const list = res.results || [];
							setResults(list);
							setPage(1);
							if (!list.length) setMessage(t("noResults"));
						}
					} catch (e) {
						setResults([]);
						setError((e && e.message) || String(e));
					} finally {
						setBusy(false);
					}
				},
				[api, refreshInstalled, t],
			);

			const runSearch = React.useCallback(
				async (nextQuery, nextSource) => {
					setBusy(true);
					setMessage("");
					setError("");
					try {
						if (!api || typeof api.search !== "function") {
							setResults([]);
							setError(t("loadFailed") + ": api unavailable");
							return;
						}
						const [res] = await Promise.all([
							api.search(nextQuery, { source: nextSource, verify: false }),
							refreshInstalled(),
						]);
						if (!res || !res.ok) {
							setResults([]);
							setError((res && res.message) || t("loadFailed"));
						} else {
							const list = res.results || [];
							setResults(list);
							setPage(1);
							if (!list.length) setMessage(t("noResults"));
						}
					} catch (e) {
						setResults([]);
						setError((e && e.message) || String(e));
					} finally {
						setBusy(false);
					}
				},
				[api, t, refreshInstalled],
			);

			React.useEffect(() => {
				void refreshInstalled();
			}, [refreshInstalled]);

			React.useEffect(() => {
				if (!api) return undefined;
				const offs = [];
				if (typeof api.subscribePluginChanged === "function") {
					offs.push(
						api.subscribePluginChanged(() => {
							void refreshInstalled();
						}),
					);
				}
				if (typeof api.subscribeInstallState === "function") {
					offs.push(
						api.subscribeInstallState((progress) => {
							if (!progress || !progress.requestId) return;
							const job = jobsRef.current[progress.requestId];
							if (!job) return;
							const phase = progress.phase || "installing";
							const attempt = progress.attempt
								? ` · registry ${progress.attempt.index}/${progress.attempt.total}`
								: "";
							upsertJob(progress.requestId, {
								status: "installing",
								detail: `${phase}${attempt}`,
							});
							setInstallDetail(format(t("installPhase"), { phase: `${phase}${attempt}` }));
						}),
					);
				}
				if (typeof api.subscribeInstallLog === "function") {
					offs.push(
						api.subscribeInstallLog((chunk) => {
							if (!chunk || !chunk.requestId) return;
							const job = jobsRef.current[chunk.requestId];
							if (!job) return;
							const text = String(chunk.text || "").trim();
							if (!text) return;
							const line = text.split("\n").filter(Boolean).slice(-1)[0] || text;
							upsertJob(chunk.requestId, {
								status: "installing",
								detail: line.slice(0, 160),
							});
							setInstallDetail(format(t("installLog"), { text: line.slice(0, 160) }));
						}),
					);
				}
				return () => {
					for (const off of offs) {
						try {
							off();
						} catch {
							/* ignore */
						}
					}
				};
			}, [api, refreshInstalled, upsertJob, t]);

			// 刷新后恢复未完成的安装任务
			React.useEffect(() => {
				if (!api || typeof api.waitInstall !== "function") return undefined;
				let cancelled = false;
				const pending = Object.values(jobsRef.current).filter((job) => job && job.status === "installing" && job.requestId);
				for (const job of pending) {
					void (async () => {
						setInstallDetail(format(t("installProgress"), { spec: job.spec || job.requestId }));
						try {
							const res = await api.waitInstall(job.requestId);
							if (cancelled) return;
							if (res && res.pending) return;
							if (res && res.ok) {
								finishJob(job.requestId, {
									status: "installed",
									packageName: res.packageName || job.packageName,
									detail: res.message || "",
								});
								setMessage(res.message || t("installed"));
								await refreshInstalled();
							} else {
								finishJob(job.requestId, {
									status: "failed",
									detail: (res && res.message) || t("installFailed"),
								});
								setError((res && res.message) || t("installFailed"));
							}
						} catch (e) {
							if (cancelled) return;
							finishJob(job.requestId, {
								status: "failed",
								detail: (e && e.message) || String(e),
							});
						} finally {
							if (!cancelled) setInstallDetail("");
						}
					})();
				}
				return () => {
					cancelled = true;
				};
			}, [api, finishJob, refreshInstalled, t]);

			React.useEffect(() => {
				if (browseMode === "recommend") {
					void runCatalog("recommend", "featured");
				} else if (browseMode === "category") {
					void runCatalog("category", category);
				}
			}, [browseMode, category, runCatalog]);

			React.useEffect(() => {
				if (browseMode !== "search") return;
				void runSearch(query.trim() || DEFAULT_QUERY, source);
			}, [browseMode, source, runSearch]);

			const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
			const safePage = Math.min(page, pages);
			const pageItems = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

			const onSearch = () => {
				setBrowseMode("search");
				void runSearch(query.trim() || DEFAULT_QUERY, source);
			};

			const onBrowseMode = (mode) => {
				setBrowseMode(mode);
				setMessage("");
				setError("");
			};

			const onResolve = async () => {
				const raw = resolveInput.trim();
				// 关键词误填到解析框时，自动走搜索
				if (raw && !/^https?:\/\//i.test(raw) && !/^(github:|gitlab:|bitbucket:)/i.test(raw) && !/^[@a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(raw) && (/\s/.test(raw) || /[\u4e00-\u9fff]/.test(raw))) {
					setQuery(raw);
					setResolveInput("");
					setBrowseMode("search");
					void runSearch(raw, source);
					return;
				}
				setBusy(true);
				setMessage("");
				setError("");
				try {
					const res = await api.resolve(raw);
					if (res && res.ok && res.inspection && res.inspection.bundle) {
						const item = {
							spec: res.spec,
							installSpec: res.spec,
							title: res.inspection.name || res.spec,
							description: res.inspection.description || "",
							source: res.source || "resolve",
							bundle: true,
						};
						setResults([item]);
						setPage(1);
						if (isInstalledItem(item, installedNames)) {
							setMessage(t("alreadyInstalled"));
							return;
						}
						const requestId = newRequestId();
						upsertJob(requestId, {
							status: "installing",
							spec: res.spec,
							keys: candidateKeys(item),
							packageName: res.inspection.name || "",
							detail: "",
						});
						setInstallDetail(format(t("installProgress"), { spec: res.spec }));
						const installed = await api.install(res.spec, { requestId });
						if (installed && installed.alreadyInstalled) {
							finishJob(requestId, {
								status: "installed",
								packageName: installed.packageName || res.inspection.name || res.spec,
								detail: installed.message || "",
							});
							setMessage(installed.message || t("alreadyInstalled"));
						} else if (installed && installed.ok) {
							finishJob(requestId, {
								status: "installed",
								packageName: installed.packageName || res.inspection.name || res.spec,
								detail: installed.message || "",
							});
							setMessage(installed.message || t("installed"));
							await refreshInstalled();
						} else {
							finishJob(requestId, {
								status: "failed",
								detail: (installed && installed.message) || t("inspectFailed"),
							});
							setError((installed && installed.message) || t("inspectFailed"));
						}
					} else {
						setResults([]);
						setError((res && res.message) || t("inspectFailed"));
					}
				} catch (e) {
					setError((e && e.message) || String(e));
				} finally {
					setInstallDetail("");
					setBusy(false);
				}
			};

			const onInstall = async (item) => {
				const spec = item.installSpec || item.spec;
				const current = resolveItemStatus(item, installedNames, jobs);
				if (!spec || current.status === "installed" || current.status === "installing") return;
				const requestId = newRequestId();
				upsertJob(requestId, {
					status: "installing",
					spec,
					keys: candidateKeys(item),
					packageName: item.title || "",
					detail: "",
				});
				setInstallDetail(format(t("installProgress"), { spec }));
				setMessage("");
				setError("");
				try {
					const res = await api.install(spec, { requestId });
					if (res && res.alreadyInstalled) {
						finishJob(requestId, {
							status: "installed",
							packageName: res.packageName || item.title || spec,
							detail: res.message || "",
						});
						setMessage(res.message || t("alreadyInstalled"));
						await refreshInstalled();
					} else if (res && res.ok) {
						finishJob(requestId, {
							status: "installed",
							packageName: res.packageName || item.title || spec,
							detail: res.message || "",
						});
						for (const key of candidateKeys(item)) markInstalled(key);
						await refreshInstalled();
						setMessage(res.message || t("installed"));
					} else {
						finishJob(requestId, {
							status: "failed",
							detail: (res && res.message) || t("installFailed"),
						});
						setError((res && res.message) || t("installFailed"));
					}
				} catch (e) {
					finishJob(requestId, {
						status: "failed",
						detail: (e && e.message) || String(e),
					});
					setError((e && e.message) || String(e));
				} finally {
					setInstallDetail("");
				}
			};

			const sourceOptions = [
				{ value: "all", label: t("sourceAll") },
				{ value: "npm", label: t("sourceNpm") },
				{ value: "github", label: t("sourceGithub") },
			];
			const browseOptions = [
				{ value: "recommend", label: t("browseRecommend") },
				{ value: "category", label: t("browseCategory") },
				{ value: "search", label: t("browseSearch") },
			];
			const categoryChips = [
				{ id: "featured", label: t("categoryAll") },
				...categories
					.filter((cat) => cat && cat.id && cat.id !== "featured")
					.map((cat) => ({ id: cat.id, label: categoryLabel(cat, lang) })),
			];
			const browseCardTitle =
				browseMode === "recommend"
					? t("recommendCardTitle")
					: browseMode === "category"
						? t("categoryCardTitle")
						: t("searchCardTitle");
			const browseCardDesc =
				browseMode === "recommend"
					? t("recommendCardDesc")
					: browseMode === "category"
						? t("categoryCardDesc")
						: t("searchCardDesc");
			const originKey =
				catalogInfo.origin === "gitee"
					? "catalogOriginGitee"
					: catalogInfo.origin === "github"
						? "catalogOriginGithub"
						: catalogInfo.origin === "cache"
							? "catalogOriginCache"
							: catalogInfo.origin === "remote"
								? "catalogOriginRemote"
								: "catalogOriginBundled";
			const onRefreshCatalog = () => {
				void (async () => {
					setBusy(true);
					try {
						if (api && typeof api.listCatalog === "function") {
							const res = await api.listCatalog({
								mode: browseMode === "category" ? "category" : "recommend",
								category,
								installedNames: [...installedNamesRef.current],
								refresh: true,
							});
							if (res && res.ok) {
								if (Array.isArray(res.categories)) setCategories(res.categories);
								setCatalogInfo({
									version: res.catalogVersion || 0,
									origin: res.catalogOrigin || "bundled",
								});
								setResults(res.results || []);
								setPage(1);
							}
						}
					} finally {
						setBusy(false);
					}
				})();
			};

			return h(
				"div",
				{ style: styles.page },
				h(
					"div",
					{ style: styles.inner },
					h(
						"div",
						{ style: styles.head },
						h("h1", { style: styles.title }, t("panel")),
						h("p", { style: styles.intro }, t("intro")),
					),
					h(
						"div",
						{ style: styles.card },
						h(
							"div",
							{ style: styles.cardHead },
							h("h2", { style: styles.cardTitle }, browseCardTitle),
							h("p", { style: styles.cardDesc }, browseCardDesc),
							browseMode !== "search"
								? h(
										"p",
										{ style: styles.cardDesc },
										format(t("catalogMeta"), {
											version: catalogInfo.version || 0,
											origin: t(originKey),
										}),
									)
								: null,
						),
						h(
							"div",
							{ style: styles.browseTabs },
							h(SourceSeg, {
								value: browseMode,
								options: browseOptions,
								disabled: busy,
								onChange: onBrowseMode,
							}),
							browseMode !== "search"
								? h(
										Btn,
										{
											variant: "outline",
											size: "sm",
											disabled: busy,
											onClick: onRefreshCatalog,
										},
										t("refreshCatalog"),
									)
								: null,
						),
						browseMode === "category"
							? h(
									"div",
									{ style: styles.chips },
									categoryChips.map((chip) =>
										h(
											Chip,
											{
												key: chip.id,
												active: category === chip.id,
												disabled: busy,
												onClick: () => setCategory(chip.id),
											},
											chip.label,
										),
									),
								)
							: null,
						browseMode === "search"
							? h(
									"div",
									{ style: styles.toolbar },
									h(
										"div",
										{ style: styles.searchGrow },
										h(Field, {
											value: query,
											placeholder: t("searchPlaceholder"),
											disabled: busy,
											onChange: (e) => setQuery(e.target.value),
											onKeyDown: (e) => {
												if (e.key === "Enter") onSearch();
											},
										}),
									),
									h(SourceSeg, {
										value: source,
										options: sourceOptions,
										disabled: busy,
										onChange: (next) => setSource(next),
									}),
									h(Btn, { disabled: busy, onClick: onSearch }, busy ? t("searching") : t("search")),
								)
							: null,
					),
					h(
						"div",
						{ style: styles.card },
						h(
							"div",
							{ style: styles.cardHead },
							h("h2", { style: styles.cardTitle }, t("resolveCardTitle")),
							h("p", { style: styles.cardDesc }, t("resolveCardDesc")),
						),
						h(
							"div",
							{ style: styles.toolbar },
							h(
								"div",
								{ style: styles.searchGrow },
								h(Field, {
									value: resolveInput,
									placeholder: t("resolvePlaceholder"),
									disabled: busy,
									onChange: (e) => setResolveInput(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter") void onResolve();
									},
								}),
							),
							h(
								Btn,
								{
									variant: "outline",
									disabled: busy || !resolveInput.trim(),
									onClick: () => void onResolve(),
								},
								t("resolve"),
							),
						),
					),
					error
						? h(
								"div",
								{ style: styles.errorBox },
								h("span", null, error),
								h(
									Btn,
									{
										size: "sm",
										variant: "outline",
										disabled: busy,
										onClick: onSearch,
									},
									t("retry"),
								),
							)
						: null,
					installDetail ? h("p", { style: styles.status }, installDetail) : null,
					message && !error ? h("p", { style: styles.status }, message) : null,
					busy && !results.length
						? h("p", { style: styles.empty }, t("searching"))
						: !results.length
							? h("p", { style: styles.empty }, error ? "" : message || t("emptyTitle"))
							: h(
									"div",
									{ style: styles.list },
									pageItems.map((item) => {
										const spec = item.installSpec || item.spec;
										const current = resolveItemStatus(item, installedNames, jobs);
										const already = current.status === "installed";
										const installing = current.status === "installing";
										const sourceBadge =
											item.source === "github"
												? t("sourceGithubBadge")
												: item.catalogId || item.featured != null || item.reason
													? t("sourceCatalogBadge")
													: item.source === "npm"
														? t("sourceNpmBadge")
														: item.source || "";
										const statusBadge = already
											? h("span", { style: styles.badgeInstalled }, t("installedBadge"))
											: installing
												? h("span", { style: styles.badgeInstalling }, t("installingBadge"))
												: h("span", { style: styles.badge }, t("notInstalledBadge"));
										const whyBadge = item.reason
											? h("span", { style: styles.badge }, reasonLabel(t, item.reason))
											: null;
										return h(
											"div",
											{ key: spec, style: styles.row },
											h(
												"div",
												{ style: styles.rowMain },
												h("h3", { style: styles.rowTitle }, item.title || spec),
												item.description ? h("p", { style: styles.rowDesc }, item.description) : null,
												h(
													"div",
													{ style: styles.meta },
													sourceBadge ? h("span", { style: styles.badge }, sourceBadge) : null,
													whyBadge,
													statusBadge,
													item.stars != null ? h("span", null, format(t("stars"), { n: item.stars })) : null,
													item.url
														? h(
																"a",
																{
																	href: item.url,
																	target: "_blank",
																	rel: "noreferrer",
																	style: styles.link,
																},
																t("open"),
															)
														: null,
												),
											),
											h(
												"div",
												{ style: styles.actions },
												h(
													Btn,
													{
														size: "sm",
														variant: already ? "installed" : installing ? "installing" : "primary",
														disabled: already || installing || busy,
														onClick: () => void onInstall(item),
													},
													installing
														? t("installing")
														: already
															? t("alreadyInstalled")
															: t("install"),
												),
											),
										);
									}),
								),
					results.length
						? h(
								"div",
								{ style: styles.pager },
								h(
									"p",
									{ style: styles.status },
									format(t("pageStatus"), {
										page: safePage,
										pages,
										total: results.length,
									}),
								),
								h(
									"div",
									{ style: styles.pagerButtons },
									h(
										Btn,
										{
											variant: "outline",
											size: "sm",
											disabled: safePage <= 1 || busy,
											onClick: () => setPage((p) => Math.max(1, p - 1)),
										},
										t("pagePrev"),
									),
									h(
										Btn,
										{
											variant: "outline",
											size: "sm",
											disabled: safePage >= pages || busy,
											onClick: () => setPage((p) => Math.min(pages, p + 1)),
										},
										t("pageNext"),
									),
								),
							)
						: null,
				),
			);
		}

		const QUERY_CODEC = strictJson("dsh-plugin-discovery#pluginDiscovery/search:query");
		const OPTIONS_CODEC = strictJson("dsh-plugin-discovery#pluginDiscovery/search:options");
		const SEARCH_RESULT = strictJson("dsh-plugin-discovery#pluginDiscovery/search:result");
		const CATALOG_OPTIONS_CODEC = strictJson("dsh-plugin-discovery#pluginDiscovery/listCatalog:options");
		const CATALOG_RESULT = strictJson("dsh-plugin-discovery#pluginDiscovery/listCatalog:result");
		const INPUT_CODEC = strictJson("dsh-plugin-discovery#pluginDiscovery/resolve:input");
		const RESOLVE_RESULT = strictJson("dsh-plugin-discovery#pluginDiscovery/resolve:result");
		const SPEC_CODEC = strictJson("dsh-plugin-discovery#pluginDiscovery/installPlugin:spec");
		const INSTALL_OPTIONS_CODEC = strictJson("dsh-plugin-discovery#pluginDiscovery/installPlugin:options");
		const INSTALL_RESULT = strictJson("dsh-plugin-discovery#pluginDiscovery/installPlugin:result");
		const LIST_INSTALLED_RESULT = strictJson("dsh-plugin-discovery#pluginDiscovery/listInstalled:result");
		const WAIT_REQUEST_ID = strictJson("dsh-plugin-discovery#pluginDiscovery/waitInstall:requestId");
		const WAIT_RESULT = strictJson("dsh-plugin-discovery#pluginDiscovery/waitInstall:result");

		const TYPERT_REMOTE = {
			package: "dsh-plugin-discovery",
			descriptors: [
				{
					id: "dsh-plugin-discovery#pluginDiscovery/search",
					service: "pluginDiscovery",
					namespace: "pluginDiscovery",
					method: "search",
					invocation: { kind: "direct" },
					parameters: [
						{ name: "query", wire: "query", source: "json", codec: QUERY_CODEC },
						{
							name: "options",
							wire: "options",
							source: "json",
							acceptsUndefined: true,
							codec: OPTIONS_CODEC,
						},
					],
					result: SEARCH_RESULT,
				},
				{
					id: "dsh-plugin-discovery#pluginDiscovery/listCatalog",
					service: "pluginDiscovery",
					namespace: "pluginDiscovery",
					method: "listCatalog",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "options",
							wire: "options",
							source: "json",
							acceptsUndefined: true,
							codec: CATALOG_OPTIONS_CODEC,
						},
					],
					result: CATALOG_RESULT,
				},
				{
					id: "dsh-plugin-discovery#pluginDiscovery/resolve",
					service: "pluginDiscovery",
					namespace: "pluginDiscovery",
					method: "resolve",
					invocation: { kind: "direct" },
					parameters: [{ name: "input", wire: "input", source: "json", codec: INPUT_CODEC }],
					result: RESOLVE_RESULT,
				},
				{
					id: "dsh-plugin-discovery#pluginDiscovery/installPlugin",
					service: "pluginDiscovery",
					namespace: "pluginDiscovery",
					method: "installPlugin",
					invocation: { kind: "direct" },
					parameters: [
						{ name: "spec", wire: "spec", source: "json", codec: SPEC_CODEC },
						{
							name: "options",
							wire: "options",
							source: "json",
							acceptsUndefined: true,
							codec: INSTALL_OPTIONS_CODEC,
						},
					],
					result: INSTALL_RESULT,
				},
				{
					id: "dsh-plugin-discovery#pluginDiscovery/listInstalled",
					service: "pluginDiscovery",
					namespace: "pluginDiscovery",
					method: "listInstalled",
					invocation: { kind: "direct" },
					parameters: [],
					result: LIST_INSTALLED_RESULT,
				},
				{
					id: "dsh-plugin-discovery#pluginDiscovery/waitInstall",
					service: "pluginDiscovery",
					namespace: "pluginDiscovery",
					method: "waitInstall",
					invocation: { kind: "direct" },
					parameters: [{ name: "requestId", wire: "requestId", source: "json", codec: WAIT_REQUEST_ID }],
					result: WAIT_RESULT,
				},
			],
		};

		const inject = ["slots", "locale", "remote"];
		async function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-discovery-ui: dictionaries");
			let mountError = "";
			try {
				const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
				ctx.effect(
					() => () => {
						void unmount();
					},
					"plugin-discovery-ui: remote",
				);
			} catch (error) {
				mountError = error && error.message ? error.message : String(error);
				console.error("[plugin-discovery-ui] remote mount failed", error);
			}

			const remoteNs = () => ctx.get("remote.pluginDiscovery", false);
			const api = {
				search: async (q, opts) => {
					if (mountError) return { ok: false, message: mountError, results: [] };
					const remote = remoteNs();
					if (!remote || typeof remote.search !== "function") {
						return { ok: false, message: "remote.pluginDiscovery.search unavailable", results: [] };
					}
					const wire = await remote.search(q, opts);
					const value = unwrapRemote(wire, "search failed");
					if (value && value.ok === false && value.message && !value.results) return value;
					if (wire && wire.ok === false) return { ok: false, message: value.message, results: [] };
					return value;
				},
				listCatalog: async (opts) => {
					if (mountError) return { ok: false, message: mountError, categories: [], results: [] };
					const remote = remoteNs();
					if (!remote || typeof remote.listCatalog !== "function") {
						return { ok: false, message: "remote.pluginDiscovery.listCatalog unavailable", categories: [], results: [] };
					}
					const wire = await remote.listCatalog(opts || {});
					const value = unwrapRemote(wire, "listCatalog failed");
					if (value && value.ok === false && value.message && !value.results) return value;
					if (wire && wire.ok === false) {
						return { ok: false, message: value.message, categories: [], results: [] };
					}
					return value;
				},
				resolve: async (input) => {
					if (mountError) return { ok: false, message: mountError };
					const remote = remoteNs();
					if (!remote || typeof remote.resolve !== "function") {
						return { ok: false, message: "remote.pluginDiscovery.resolve unavailable" };
					}
					const wire = await remote.resolve(input);
					const value = unwrapRemote(wire, "resolve failed");
					if (wire && wire.ok === false) return { ok: false, message: value.message };
					return value;
				},
				install: async (spec, options) => {
					if (mountError) return { ok: false, message: mountError };
					const remote = remoteNs();
					if (!remote || typeof remote.installPlugin !== "function") {
						return { ok: false, message: "remote.pluginDiscovery.installPlugin unavailable" };
					}
					const wire = await remote.installPlugin(spec, options);
					const value = unwrapRemote(wire, "install failed");
					if (wire && wire.ok === false) {
						return {
							ok: false,
							alreadyInstalled: !!(value && value.alreadyInstalled),
							packageName: value && value.packageName,
							requestId: value && value.requestId,
							message: value && value.message,
						};
					}
					return value;
				},
				listInstalled: async () => {
					if (mountError) return { ok: false, names: [] };
					const remote = remoteNs();
					if (!remote || typeof remote.listInstalled !== "function") {
						return { ok: false, names: [] };
					}
					const wire = await remote.listInstalled();
					const value = unwrapRemote(wire, "listInstalled failed");
					if (wire && wire.ok === false) return { ok: false, names: [] };
					return value;
				},
				waitInstall: async (requestId) => {
					if (mountError) return { ok: false, message: mountError };
					const remote = remoteNs();
					if (!remote || typeof remote.waitInstall !== "function") {
						return { ok: false, message: "remote.pluginDiscovery.waitInstall unavailable" };
					}
					const wire = await remote.waitInstall(requestId);
					const value = unwrapRemote(wire, "waitInstall failed");
					if (wire && wire.ok === false) return { ok: false, message: value.message || "waitInstall failed" };
					return value;
				},
				subscribePluginChanged: (listener) => {
					try {
						return ctx.remote.$on("plugin-manager/changed", listener);
					} catch {
						return () => {};
					}
				},
				subscribeInstallState: (listener) => {
					try {
						return ctx.remote.$on("plugin-manager/install-state", listener);
					} catch {
						return () => {};
					}
				},
				subscribeInstallLog: (listener) => {
					try {
						return ctx.remote.$on("plugin-manager/install-log", listener);
					} catch {
						return () => {};
					}
				},
			};

			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID,
						locale: NS,
						inject: () => ({ api }),
					},
					Panel,
				),
			);
			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 16,
						locale: NS,
						label: () => ctx.locale.bind(NS)("panel"),
					},
					PanelIcon,
				),
			);
		}

		return { inject, apply };
	},
});
