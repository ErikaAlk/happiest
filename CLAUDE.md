# Claude Code

每次会话开始处理任务之前，必须使用 Read 工具完整读取当前工作目录的 `AGENTS.md`，遵循其中全部规则。检查返回内容是否覆盖文件末尾；存在截断时继续读取剩余部分。上下文压缩后缺少规则时重新读取。`AGENTS.md` 是本项目跨工具共享规则的唯一维护来源。

## Claude Code 指挥 Codex

本项目后续会话由 Claude Code 负责理解需求、拆分并下发任务、只读检查、审查结果与向用户汇报，Codex CLI 负责一切会改动工作区的执行工作。这是用户明确指定的项目分工，项目内允许恢复 Claude Code 调用。

- 属于 Codex 的工作：源码实现、修复、调试、测试、类型检查、构建、运行开发环境、真机与桌面操作、命令与数据验证，以及改动前后的验证。只要会改动文件、运行状态或设备，一律交给 Codex。
- 属于 Claude Code 的工作：读取与理解现有代码、定位问题、编写任务说明、只读检查 Codex 的改动与证据、审查、向用户汇报。Claude Code 不直接改动源码、不改配置、不驱动真机、不运行有副作用的命令。
- 唯一例外：用户显式要求 Claude Code 直接执行；或纯粹的只读查询与回答，不改变任何文件、配置、进程或设备状态。
- Claude Code 通过 Bash 工具调用 `codex exec`。使用当前实际工作目录，接续任务时保留已批准的计划、worktree、分支与现有改动。
- 用户已授权本项目的 Codex CLI 使用本机用户权限，调用 `codex exec --sandbox danger-full-access --json "<任务说明>"`。只读调查或审查在任务说明中明确禁止写入。模型沿用 Codex 当前配置，用户指定模型时传入 `--model`。
- 任务说明必须包含目标、写入范围、相关计划路径、验收条件、验证命令和停止条件，并要求遵循项目 `AGENTS.md`。用户的原始要求与授权边界必须完整传递。
- 从 JSONL 输出读取 `thread.started` 的 `thread_id`，记录在 Claude Code 会话上下文中；后续使用 `codex exec --sandbox danger-full-access --json resume <thread_id> "<后续任务>"` 接续同一个任务。使用明确的会话 ID。
- 同一实现任务只有 Codex 写入代码，Claude Code 在执行期间进行只读检查。需要修改方向时向同一 Codex 会话发送后续任务，等待当前执行结束。
- 等待进程结束，检查退出状态、最终结果和实际验证证据；执行失败或缺少验证时继续处理。Claude Code 验收当前文件与 diff 后再汇报。
- 需要用户决定的设计变更、破坏性操作、对外发布或进一步扩大权限，必须传回用户。本机用户权限授权仅适用于本项目，不授权跳过审批或执行任务范围之外的操作。
- 较长任务说明通过标准输入传递；需要中间文件时使用工作目录内已忽略的专用目录。
- 本节必须在每个 worktree 自己的 `CLAUDE.md` 中保留同一内容。worktree 是独立检出，会话只加载它自己目录下的 `CLAUDE.md`，主检出里的本节不会自动生效；检出或合并后若发现缺失，先从主检出同步本节再开始工作。

## TypeScript commands

Follow the canonical TypeScript compiler-ownership rules in `AGENTS.md`. Use repository/package typecheck and build scripts; `yarn tsc ...` is safe from the repository root and every TypeScript-owning workspace, and delegates to the native compiler runner. For a direct ad hoc check, use `node scripts/workspaces/runTypeScriptCli.mjs ...`. Do not run bare `tsc`, `npx tsc`, `node_modules/.bin/tsc`, or `typescript/bin/tsc`: compilation must use the centrally resolved native TypeScript 7 compiler, while the `typescript` package remains TypeScript 5.9 only for programmatic API compatibility.
