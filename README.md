# dsh-cdp-metadata

> CDP v0.1 — 给插件与工具附加「AI 可读能力语义」的元数据层。
> Host 侧 Cordis 插件，只做 **加载 → 校验 → 注册 → 暴露**，不注册工具、不连接 MCP、不做协议桥接。

---

## 这是什么 / 为什么

现有插件/工具在 DSH 里被模型「看见」的只有两块信息：`definition.description`（自然语言 prose）和 `definition.parameters`（JSON Schema 入参约束）。这两块能回答「怎么调用、传什么参数」，但回答不了三个更高层的问题：

- 这个能力**怎么推理**（演绎/归纳/溯因）？它出错时会怎样？结论有多可信？
- 这个能力**产出什么语义**？下一步该交给谁？
- 调用它**有什么副作用、花多少成本**（算力/时延/钱）？

CDP（Capability Description Protocol）v0.1 不是要重造工具定义，而是补上这层 **AI 可读的能力语义**：在工具定义之外，附一份结构化、可机器校验、可静态路由的元数据。

**本插件只做只读元数据层**：从 `sources` 读入 `.cdp.json`，按 L1/L2 校验，注册进 `ctx.cdpRegistry`，并按配置决定是否（可选地）把注解投影到工具 description。**它不 `ctx.tools.register`、不连接 MCP server/client、不桥接任何协议、绝不执行被注解的代码。**

理论价值在于看清原来看不见的脆弱性 —— 例如 `cannot` 与 `can` 的自相矛盾、声明 `none` 副作用却列出 `scope`、把「预测涨跌」包装成「分析」—— 而不是概念本身的新颖性。

---

## 与 `dsh-cordis-universal-adapter` 的关系

CDP 与 `dsh-cordis-universal-adapter` **严格正交**（设计详见 `docs/DESIGN.md` §7）。要点：

- **CDP 是上层语义层**，`dsh-cordis-universal-adapter` 关注传输/协议桥接（下层）。二者层次不同、互不冲突。
- **可同时安装、互不引用代码**：本插件代码不 `import`、不依赖 adapter；adapter 也无需知道 CDP 存在。
- **未来 adapter 可消费 `ctx.cdpRegistry`**：当 adapter 把 MCP 工具桥接进来后，可直接读取本插件暴露的注册表，给那些工具附加 CDP 注解。这条消费方向是单向的——adapter 读 CDP，CDP 不读 adapter。
- **标识面完全隔离**：本插件包名/插件 id 为 `dsh-cdp-metadata`、提供 `cdpRegistry` 服务、无命名前缀；adapter 使用 `universalAdapter` 服务与 `mcp::`/`dsh:` 前缀。两者 config 段也不重叠（adapter 用 `servers`/`pluginDirs`/`export`/`router`/`naming`/`schema`，本插件仅 `sources`/`validation`/`expose`）。

---

## 快速开始

### 1. 安装

```bash
npm install dsh-cdp-metadata
```

运行时仅依赖 `@deepseek-ai/cordis` 与 `@deepseek-ai/dsh-tools`（peerDependencies）。**不**声明 `@modelcontextprotocol/*` 依赖。

### 2. 配置（`cordis.patch.yml`）

在 Host 的 `cordis.patch.yml` 中插入本插件。配置**只有** `sources` / `validation` / `expose` 三段：

```yaml
dsh-cdp-metadata:
  sources:
    - "./agent-plugins"
  validation:
    level: "L2"
    onInvalid: "warn"
    conflictStrategy: "prefix"
  expose:
    attachToTools: false
```

字段含义：

- `sources`：待扫描的目录/文件路径列表（相对 Host 工作目录解析）。
- `validation.level`：`L1`（语法）或 `L2`（语法 + 静态语义）。
- `validation.onInvalid`：`warn` | `error`。
- `validation.conflictStrategy`：重复 `id` 时的处理，`prefix`（追加 `#n` 后缀）或 `error`（抛错）。
- `expose.attachToTools`：是否把注解投影进工具 description（见下文「`expose.attachToTools`」一节），默认 `false`。

---

## CDP v0.1 字段参考

顶层结构为 `{ "capability": { ... } }`。完整 JSON Schema 以 `docs/CDP-SCHEMA.v0.1.json` 为单一真理源，下面给出字段表（与 Schema 互为镜像）。

| 字段路径 | 类型 | 必填 | 枚举 / 格式 | 语义 |
|---|---|---|---|---|
| `capability.id` | string | 是 | `name@v?\d+.\d+` | 能力唯一标识，注册表主键 |
| `capability.identity.name` | string | 是 | — | 人类可读名（可中文） |
| `capability.identity.archetype` | enum | 是 | analyzer/executor/advisor/orchestrator/validator | 角色原型 |
| `capability.boundaries.can` | string[] | 是 | — | 能做到的事 |
| `capability.boundaries.cannot` | string[] | 是 | — | 明确不做的事（L2 冲突检测对象） |
| `capability.boundaries.requires` | string[] | 是 | — | 前置条件 |
| `capability.cognitive_style.reasoning_type` | enum | 是 | deductive/inductive/abductive | 推理范式 |
| `capability.cognitive_style.uncertainty_expression` | enum | 是 | explicit/implicit | 不确定性是否显式 |
| `capability.cognitive_style.failure_mode` | enum | 是 | fail_loud/fail_silent | 失败表现 |
| `capability.cognitive_style.archetype` | enum | 是 | 同 identity | 与 identity 对齐；不一致时 L2 告警 |
| `capability.output.semantic_tags` | string[] | 是 | — | 输出语义标签（路由/检索键） |
| `capability.output.downstream_hints` | array | 是 | `{if_tag, suggest_to}[]` | 跨插件路由提示 |
| `capability.runtime.side_effects.level` | enum | 是 | none/read-only/state-changing/irreversible | 副作用分级 |
| `capability.runtime.side_effects.scope` | string[] | 是 | — | 受影响范围（level=none 时应为空） |
| `capability.runtime.cost.compute` | enum | 是 | low/mid/high | 算力分级 |
| `capability.runtime.cost.latency` | string | 是 | `^(<)?\d+(\.\d+)?(ms|[smh])$` | 时延上界（如 `<1s`） |
| `capability.runtime.cost.monetary` | enum | 是 | free/per_call/metered | 货币模型 |

### 三块真实增量

CDP 大部分字段是对既有规范（MCP / OpenAPI / SKILL.md 等）的**整合重组**（详见 `docs/PRIOR-ART.md`）。真正值得强调的增量只有三块：

1. **`cognitive_style`** —— 给工具声明「推理人格」（reasoning_type / uncertainty_expression / failure_mode / archetype）。在所查先验协议中**未发现先例**，这是 CDP 唯一堪称「新」的主张。
2. **`output.semantic_tags` + `downstream_hints`** —— 跨插件路由提示（`if_tag → suggest_to`）。标签本身是整合，但「基于输出语义标签驱动下游编排」的声明式提示是小的增量。
3. **`runtime.side_effects`（四级分级 + `scope`）+ `cost`** —— 与 MCP `readOnlyHint`/`destructiveHint` **明确重叠**（已如实承认）；增量在于有序四级（而非两个布尔）、显式 `scope`、以及与算力/时延/货币成本的统一画像。

### 完整 `.cdp.json` 示例

```json
{
  "capability": {
    "id": "stock_analyzer@v1.0",
    "identity": {
      "name": "股票基本面分析器",
      "archetype": "analyzer"
    },
    "boundaries": {
      "can": [
        "读取指定股票的财报与基本面指标",
        "给出估值区间与风险提示"
      ],
      "cannot": [
        "预测明天股价涨跌",
        "给出具体买卖指令"
      ],
      "requires": [
        "已提供有效的股票代码",
        "该股票在交易所正常上市"
      ]
    },
    "cognitive_style": {
      "reasoning_type": "deductive",
      "uncertainty_expression": "explicit",
      "failure_mode": "fail_loud",
      "archetype": "analyzer"
    },
    "output": {
      "semantic_tags": ["equity_analysis", "valuation"],
      "downstream_hints": [
        { "if_tag": "valuation", "suggest_to": "risk_assessor@v1.0" }
      ]
    },
    "runtime": {
      "side_effects": {
        "level": "none",
        "scope": []
      },
      "cost": {
        "compute": "low",
        "latency": "<2s",
        "monetary": "free"
      }
    }
  }
}
```

> **诚实说明**：`cognitive_style`、`side_effects`、`cost` 全部是**作者自陈声明**。本插件不做任何运行时验证（L3 不可行），其真实性由作者负责。

---

## 校验级别

CDP 提供三层校验模型（详见 `docs/DESIGN.md` §4）：

- **L1 — 语法校验**：结构与枚举校验，镜像 `CDP-SCHEMA.v0.1.json`。覆盖必填字段存在、枚举合法、`id`/`latency` 格式、数组项非空、禁止未知字段。失败 → 对应 capability 不注册。
- **L2 — 语义静态检查**：纯静态、字符串级，不执行任何代码。包括 `can`/`cannot` 冲突启发式检测、`downstream_hints.if_tag` 必须命中 `semantic_tags`、`cost.latency` 格式，以及跨字段一致性（如 `side_effects.level==='none'` 却列 `scope`、`identity.archetype !== cognitive_style.archetype`）。
- **L3 — 行为验证**：**仅留接口 + TODO，不实现**。需要真实执行被注解工具并构造对抗样本，本插件是只读元数据层、无执行权限、无沙箱，且 `cannot` 类声明数学上常不可反驳。交由未来带沙箱的验证子系统或人工审计。

配置 `validation.level: "L1"` 时只跑语法；`"L2"` 时语法 + 静态语义。

### `onInvalid: "warn"` 的分级行为

`validation.onInvalid` 控制 L1/L2 失败的处理方式：

- **L1 语法失败 → 跳过不注册 + 告警**：该 capability 不被加入注册表（元数据不可用），但以 `[cdp]` 前缀日志告警，不阻断插件启动。
- **L2 语义失败 → 仍注册 + 告警**：对应 capability **照常注册**（信任作者声明，元数据仍可用），但冲突/不一致被显式暴露。
- **`onInvalid: "error"`**：任一 L1/L2 失败聚合为 `CdpValidationAggregateError` 抛出，插件 effect 失败。
- **安全错误不受 `onInvalid` 控制**：路径逃逸等 `CdpSecurityError` **永远抛**，不可降级。

---

## 服务 API

本插件通过 `ctx.provide('cdpRegistry', registry)` 暴露注册表服务，供未来 adapter / prompt 组装消费。查询接口（按 `docs/DESIGN.md` §9 registry 契约）：

```ts
interface CdpRegistry {
  /** 注册一个已通过校验的 capability（内部调用，重复 id 按 conflictStrategy 处理） */
  register(cap: Capability): void;
  /** 按 id 精确获取（含可能被 prefix 策略改写后的实际 id） */
  get(id: string): Capability | undefined;
  /** 列出全部已注册 capability */
  list(): Capability[];
  /** 把 capability 压成紧凑、模型可读的 marker 文本，如 [CDP: deductive/explicit/fail_loud | SE:none | $:free] */
  formatMarker(cap: Capability): string;
  /** 纯函数：返回带 [CDP: …] 后缀 description 的 schema 副本，零副作用（推荐投影主路径） */
  decorateSchemas(schemas: ToolSchema[], bindings: Record<string, string>): ToolSchema[];
}

interface ToolSchema {
  name: string;
  description: string;
  parameters: unknown;
}
```

消费方通过 `ctx.get('cdpRegistry')` 读取（注意：这是 Cordis 服务获取约定，具体 API 名以工程师实现的 `src/registry.ts` 为准；本 README 描述的是契约形态，不臆造新方法）。

---

## `expose.attachToTools`

默认 **`false`**。原因：

- 投影进工具 description 依赖 `dsh-tools` 的**私有契约**（必须取 `ctx.tools.get(name)` 返回的活 `ToolDefinition` 引用改写 `description`，否则改 `schemas()` 投影副本是 no-op）。
- 该操作有**副作用**：会真实改变模型可见文本，且依赖的活引用契约未来版本可能变更而破。

**开启后（仅当显式 `attachToTools: true`）：**

- 经 `ctx.tools.get(toolName)` 取活引用改写 `description`；
- 用 `WeakMap` 记录原始 `description` 做**幂等守卫**（已记录或 `description` 已含 `[cdp]` 哨兵则跳过）；
- **只碰 `description`，绝不碰 `parameters` / `execute`**；
- 改写内容：`description + ' ' + registry.formatMarker(cap)`；
- 在 `ctx.effect` 的 disposer 中把 `description` **还原**为原始值（fiber 卸载时自动触发）；
- 若 `ctx.tools` 或 `ctx.tools.get` 不存在 → 安静跳过，不报错。

**`expose.bindings` — 显式 capabilityId → toolName 映射：**

因样例 `identity.name` 是中文、无法与工具名匹配，本插件**不靠名字猜**。需显式声明「哪个能力注解哪只工具」：

```yaml
expose:
  attachToTools: true
  bindings:
    stock_analyzer@v1.0: "dsh-tools:stock_analyzer"
```

> 保留的坦诚风险：`attachToTools` 依赖 dsh-tools 内部契约（活引用），已验证当前 `@deepseek-ai/dsh-tools` 行为，但属私有契约，未来版本变更会破——需回归测试守护。

---

## CLI

本插件附带 `cdp-annotate` 命令行工具，用于辅助生成/校验 `.cdp.json`。

```bash
# 校验一个或多个 .cdp.json 文件
cdp-annotate check path/to/capability.cdp.json [more...]

# 按交互/模板生成一个 .cdp.json 骨架
cdp-annotate init --id stock_analyzer@v1.0 --name "股票基本面分析器" --archetype analyzer -o capability.cdp.json
```

参数说明：

- `check <files...>`：对每个文件做 L1（可选 +L2）校验，打印错误/告警，全部通过则退出码 0。
- `init`：`--id`、`--name`、`--archetype` 必填；`-o/--output` 指定输出路径；生成带默认空数组与枚举首值的骨架。
- 全局 `--level L1|L2`：校验级别（默认 L2）。

---

## 安全模型

- **唯一 IO 依赖**：`node:fs/promises`。禁用 `child_process`、禁用 `eval`/`new Function`、禁用动态 `import()` 被注解代码、绝不执行被注解能力。
- **路径白名单 + realpath 逃逸校验**：`sources` 解析后必须落在 root 内，`realpath` 解析符号链接后仍须落在 root 内，否则抛 `CdpSecurityError`（不可降级）。
- **DoS 防护**（具体值可在 config 调）：
  - `maxFileBytes = 1048576`（1 MiB）：单文件大小上限，超出跳过并记入 `skipped`。
  - `maxDepth = 8`：扫描深度上限。
  - `maxFiles = 1000`：扫描文件总数上限，超出停止并告警。
- 解析得到的 JSON 仅做 `JSON.parse` + L1/L2 校验，**不实例化、不执行**其中任何代码/函数。

---

## 已知限制（诚实，不粉饰）

引用 `docs/PRIOR-ART.md` 与 `docs/DESIGN.md` §10 的结论：

1. **真实增量仅 `cognitive_style`**：`semantic_tags`/`downstream_hints` 是部分增量（路由提示为新），`side_effects` 与 MCP `readOnlyHint`/`destructiveHint` **重叠**，其余字段为对既有规范的整合重组。
2. **`side_effects` 与 MCP annotations 重叠**：四级分级 + `scope` 是细化而非全新概念；若只需「只读/破坏」二元判断，MCP annotations 已够用。
3. **L2 字符串级会漏检**：`can`/`cannot` 矛盾检测基于字面归一化，会漏检同义改写与抽象层级差异，**不是语义推理**，只能兜底明显矛盾。
4. **`attachToTools` 依赖私有契约**：直接改 `definition.description` 依赖 dsh-tools 当前实现（活引用），未来版本变更会破。
5. **声明即信任**：`cognitive_style` / `cost` / `side_effects` 均为作者自陈，CDP 不验证真实性；恶意或粗心作者可伪造。
6. **L3 未实现且不可行**：`cannot` 类声明数学上常不可反驳；本插件无沙箱、无执行权限。
7. **无版本协商**：仅 `id@vX.Y` 字符串，无字段级向后兼容机制。
8. **绑定需显式**：`expose.bindings` 需人工维护 capabilityId↔toolName 映射，无自动发现。

---

## License

[MIT](./LICENSE) © 2026 helibeiqi
