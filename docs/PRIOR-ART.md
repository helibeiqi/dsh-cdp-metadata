# CDP v0.1 先验协议对照（PRIOR-ART）

> 目的：逐条诚实标注 CDP 每块是「真新增 / 整合重组 / 换皮重叠」，不包装成原创。
> 结论先行：CDP 真实增量只有三块（§结论）。其余是对既有规范的**整合重组**。

---

## 逐协议对照

### 1. MCP（Model Context Protocol）tool definition + tool annotations
- MCP 工具定义：`name` / `description` / `inputSchema` / `outputSchema`。
- MCP **tool annotations**：`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`（布尔提示）。

| CDP 块 | 与 MCP 的关系 | 判定 |
|---|---|---|
| `runtime.side_effects` | 与 `readOnlyHint`/`destructiveHint` **高度重叠**——二者都想表达"这工具改不改东西"。但 CDP 是**四级分级** `none/read-only/state-changing/irreversible`（等价于把两个布尔 hints 升级为有序枚举），并额外带 `scope[]` 列表（受影响资源），再与 `cost` 组合 | **重叠 + 增量** |
| `runtime.cost` | MCP 无成本字段；CDP 的 `cost` 属自有补充 | **增量** |
| `cognitive_style` 等其余 | MCP 无对应 | 见各自条目 |

**诚实结论**：`side_effects` 不是原创，是 MCP annotations 的**细化与扩展**。CDP 的增量在于——(a) 四级有序分级而非两个布尔；(b) `scope` 显式列出受影响范围；(c) 与 `cost{compute,latency,monetary}` 组合成统一的"调用代价画像"。若只想要"只读/破坏"二元判断，MCP annotations 已够用。

### 2. OpenAPI 3.x
- 有 `description`、`operationId`、`servers`、`x-` 厂商扩展。
- **无标准副作用/成本字段**：副作用与成本只能塞进 `description` prose 或 `x-` 扩展（非结构化、不可机检）。

| CDP 块 | 与 OpenAPI 关系 | 判定 |
|---|---|---|
| `cost` / `side_effects` | 等价于把 OpenAPI 里写在 `description` 或 `x-cost` 的非结构化信息**结构化、可校验** | **整合重组** |
| `output.semantic_tags` | 类似 OpenAPI 的 `tags`（用于分类/检索），但 CDP 标签语义绑定到"输出"且驱动路由 | **整合重组** |
| `identity` / `boundaries` | 无直接对应；近似于把 `description` 里"能做什么/不能做什么"抽成结构化字段 | **整合重组** |

结论：CDP 在成本/副作用表达上**没有超越 OpenAPI `x-` 扩展的新能力**，只是强制结构化并加了校验。

### 3. Anthropic `SKILL.md`（frontmatter `name`/`description` + 渐进式披露）
- SKILL.md 用 YAML frontmatter 声明 `name`/`description`，正文做渐进式披露。
- CDP 的 `identity.name` + `boundaries` 与之精神相似（用结构化头声明"我是谁、能做什么"）。

| CDP 块 | 判定 |
|---|---|
| `identity` + `boundaries` | **整合重组**（借鉴 skill 的"头声明"范式，但字段更细、可校验） |
| `cognitive_style` / `cost` / `side_effects` | SKILL.md 无对应 → 见各自条目 |

### 4. JSON Schema `description` / `$comment`
- `description` 给人/工具读；`$comment` 给工具读、应被忽略。
- CDP **不是**把语义塞进参数 JSON Schema，而是**平行于工具定义**的一层独立元数据（挂在 `ctx.cdpRegistry`，不污染 `parameters`）。

| CDP 块 | 判定 |
|---|---|
| 整体定位 | **整合**（复用"描述+注释"的二分思想，但放在独立层而非参数 schema 内） |

### 5. schema.org `Action`
- `Action` 有 `object`/`result`/`agent`/`error` 等动作语义。
- CDP 的 `boundaries`/`output` 在"动作语义"层面与 `Action` 同向，但 CDP 聚焦**Agent 编排视图**（认知风格、路由、代价），不建模完整动作本体。

| CDP 块 | 判定 |
|---|---|
| `boundaries` / `output` | **整合重组**（轻量动作语义，非本体级） |

### 6. W3C WoT Thing Description（TD）
- TD 有 `forms`（交互端点）、`security`（安全方案）、`properties`/`actions`。
- TD **有安全/副作用建模意图**（security definitions），但**无认知风格**、无成本画像、无跨物路由提示。

| CDP 块 | 判定 |
|---|---|
| `side_effects` / `cost` | **部分重叠**（TD 的 security 也描述"动这台设备会怎样"），但 CDP 是 Agent 视角的轻量分级，非设备安全本体 |
| `cognitive_style` | TD 无对应 → 见各自条目 |

### 7. LangChain / LlamaIndex tool description 惯例
- 惯例：工具只有一个自然语言 `description` 字符串（常含"Use this when..."指令）。
- CDP 是把这种**散落在 prose 里的隐含契约**抽成可机检字段。

| CDP 块 | 判定 |
|---|---|
| 整体 | **整合重组**（结构化既有的"工具该何时用"隐含知识） |

---

## 总判定表

| CDP 块 | 先验中最接近者 | 判定 | 真新增？ |
|---|---|---|---|
| `cognitive_style`（reasoning_type/uncertainty_expression/failure_mode/archetype） | 无先例 | **真新增** | ✅ |
| `output.semantic_tags` + `downstream_hints` | OpenAPI `tags` / operationId、schema.org | **整合 + 路由增量** | ⚠️ 部分（跨插件路由提示为新） |
| `runtime.side_effects`（四级 + scope） | MCP annotations、WoT security | **重叠 + 细化增量** | ⚠️ 部分（四级+scope 为新） |
| `runtime.cost` | OpenAPI `x-` 扩展 | **整合重组** | ❌ |
| `identity` + `boundaries` | SKILL.md frontmatter、JSON Schema description | **整合重组** | ❌ |
| 整体分层（独立元数据层，不污染 parameters） | JSON Schema `description`/`$comment` 二分 | **整合重组** | ❌ |

---

## 结论

**CDP v0.1 的真实增量只有三块**：

1. **`cognitive_style`** —— 给工具声明"推理人格"（`reasoning_type`/`uncertainty_expression`/`failure_mode`）。在已查的 MCP / OpenAPI / SKILL.md / JSON Schema / schema.org / WoT TD / LangChain 惯例中**均未发现先例**，这是 CDP 唯一堪称"新"的主张。
2. **`semantic_tags` + `downstream_hints`** —— 跨插件路由提示（`if_tag → suggest_to`）。标签本身是整合，但"基于输出语义标签驱动下游编排"的声明式提示是小的增量。
3. **`side_effects` 四级分级 + `scope` + 与 `cost` 组合** —— 与 MCP tool annotations **明确重叠**（已如实承认）；增量在于有序四级（而非两个布尔）、显式 `scope`、以及与算力/时延/货币成本的统一画像。

**其余皆为整合重组**：成本/边界表达等价于 OpenAPI `x-` 扩展结构化；`identity`/`boundaries` 等价于把 SKILL.md / description 里的隐含契约抽出；整体定位等价于 JSON Schema 的"描述层与注释层"二分思想。

**理论价值不在新颖性**：CDP 的意义是给既有散落的、不可机检的能力描述**强制结构化 + 可静态校验**，从而让"can/cannot 自相矛盾""声明无副作用却列 scope""把预测包装成分析"这类原本看不见的脆弱性**变得可被发现**（见 DESIGN §1、§10）。
