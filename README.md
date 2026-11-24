# Site Control

> Build websites you can own, operate, and evolve — even after the original AI session ends.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Agent Skill](https://img.shields.io/badge/Agent-Skill-6857c2) ![MCP](https://img.shields.io/badge/MCP-ready%20standard-0969da)

[简体中文](#简体中文) · [English](#english) · [Agent Skill](SKILL.md) · [Architecture](references/architecture.md)

<!-- HUB-PROGRESS:BEGIN -->
## 🚧 Site Control Hub 2.0 · 开发进度 / Roadmap

[![Stage](https://img.shields.io/badge/Hub-2.0%20Alpha-orange)](https://github.com/Dreaminmaster/site-control/pull/1)
[![Build](https://github.com/Dreaminmaster/site-control/actions/workflows/hub-check.yml/badge.svg?branch=feature%2Fsite-control-hub-v2)](https://github.com/Dreaminmaster/site-control/actions?query=branch%3Afeature%2Fsite-control-hub-v2)
![Deployment](https://img.shields.io/badge/Deployment-not%20deployed-lightgrey)
![Migration](https://img.shields.io/badge/Existing%20sites-optional-lightgrey)

**独立平台验收阶段进度：3 / 7（42.9%）** · Delivery gates, not effort or ETA.

`███░░░░`  基础实现、离线测试与本地 HTTP/OAuth/MCP 验收已通过。  
**当前阶段：** 本地安全、恢复和双站持久化已通过；云端授权未获得，浏览器自动验收已通过。
**最近核验：** 2026-11-25（Australia/Sydney）；完整通过的代码 `43f1b9f`，[18 项测试与恢复演练](https://github.com/Dreaminmaster/site-control/actions/runs/45414333075)；浏览器验收提交 `bb78a4b`，[本轮 CI](https://github.com/Dreaminmaster/site-control/actions/runs/45414547923)。

| 阶段 / Gate | 进度 | 验收依据 / 下一步 |
| --- | --- | --- |
| 01 基础架构与源码 | 🟢 已完成 | 五页管理台、D1/KV、SDK、7 个 MCP 工具、通用资源集合 |
| 02 离线测试与构建 | 🟢 已通过 | [18 项测试、锁定依赖审计、双数据库迁移与双 Worker 构建](https://github.com/Dreaminmaster/site-control/actions/runs/45414333075) |
| 03 HTTP / 本地 OAuth / MCP | 🟢 已通过 | [实际 Worker、PKCE、MCP、独立 fixture SDK 与磁盘持久化、重连、回滚](https://github.com/Dreaminmaster/site-control/actions/runs/45414333075)；合成身份 |
| 04 安全与发布准备 | 🟡 本地已通过，待云端复核 | [锁定依赖扫描 0 已知漏洞、公开 OAuth 限流、D1 隔离导出/恢复、旧任务撤销](https://github.com/Dreaminmaster/site-control/actions/runs/45414333075)；独立部署配置生成器已实现；仍需云端边缘防滥用及真实安全复核 |
| 05 Cloudflare 测试部署 | ⚪ 待授权 | 独立 Workers、D1/KV、Secrets、真实 GitHub 身份 |
| 06 独立测试站云端接入 | ⚪ 待部署 | 独立真实站点持久化、审批、回执、撤销、恢复 |
| 07 统一 OAuth / MCP 云端 | ⚪ 待验证 | 独立真实 ChatGPT 客户端的连接及跨会话授权 |

**下一步阻塞：** 需要一次 Cloudflare 账户授权，使用新建独立测试资源（不接入现有站点）。参阅 [隔离部署手册](https://github.com/Dreaminmaster/site-control/blob/feature/site-control-hub-v2/hub/RELEASE.md)。

**现有网站接入：暂停，平台完成后由所有者逐个决定。** 不计入独立平台完成进度；允许全部原站继续独立运行，不强制迁移。

<details>
<summary>展开功能进度 / Feature checklist</summary>

| 功能 | 实现 | 已验证范围 |
| --- | --- | --- |
| 管理台：概览、网站、审批、AI 授权、审计 | 🟢 | 本地渲染/HTTP 通过；真实浏览器五页、双尺寸与搜索自动测试已通过；[浏览器 CI](https://github.com/Dreaminmaster/site-control/actions/runs/45414547923) |
| GitHub 所有者登录 | 🟢 | 合成会话；真实 GitHub 登录待测试 |
| 站点注册、独立令牌、轮换与撤销 | 🟢 | 本地 HTTP 通过 |
| MCP 7 个基础与资源工具 | 🟢 | 本地 OAuth/PKCE 及工具调用通过 |
| 同一 OAuth 连接增加站点、逐站读/提案权限 | 🟢 | 同一令牌测试通过；真实 ChatGPT 待测 |
| 审批、版本检查、审计、恢复提案 | 🟢 | 本地 D1/HTTP 通过 |
| 通用资源定义及类型校验 | 🟢 | 小型非敏感记录集合，本地测试通过 |
| 服务端 SDK 与独立测试站 | 🟢 | 真实本地 Hub HTTP + 独立 fixture handler + 磁盘 SQLite；持久化、回滚、撤销后重连均通过；云端待测 |
| 独立发布、备份恢复、真实客户端 | 🟡 | 本地 D1 导出/隔离恢复通过；生产备份恢复、Cloudflare 部署、真实客户端待验收 |

🟢 已实现或已通过所列验收；🟡 进行中；🔴 阻塞；⚪ 未完成。代码存在不等于服务已上线。

</details>

**开发入口：** [草稿 PR #1](https://github.com/Dreaminmaster/site-control/pull/1) · [开发分支](https://github.com/Dreaminmaster/site-control/tree/feature/site-control-hub-v2) · [Hub 源码与部署说明](https://github.com/Dreaminmaster/site-control/blob/feature/site-control-hub-v2/hub/README.md) · [独立发布与恢复手册](https://github.com/Dreaminmaster/site-control/blob/feature/site-control-hub-v2/hub/RELEASE.md) · [接入规范](https://github.com/Dreaminmaster/site-control/blob/feature/site-control-hub-v2/references/hub-v2.md)

> **维护规则：** 在独立平台完成之前保留本区块。每次有实质性开发、测试或部署进展，维护者同时更新默认分支与开发分支的 README，记录核验日期、证据链接、阻塞和下一步；仅通过明确验收门槛的阶段计入进度。构建徽章自动反映 CI，阶段进度由维护者依据验收证据更新。全部独立平台验收通过并正式发布后，可替换为稳定版状态与发布记录。现有网站接入必须单独由所有者确认，不属于平台完成的先决条件。公开 README 不得包含私人站点地址、个人数据或密钥。

<!-- HUB-PROGRESS:END -->

## 简体中文

Site Control 是一套面向人类和 AI Agent 的网站开发与交付规范。它要求开发者不仅交付网站，还交付可独立维护的源码、管理入口、授权机制和恢复流程。适用于新建网站、升级现有网站及管理多个网站。

### 你能获得什么

| 能力 | 说明 |
| --- | --- |
| 独立源码 | 可编辑代码、Git 版本、开发和部署文档 |
| 管理空间 | 经身份验证的后台，支持适用的内容、配置、主题、日志和诊断管理 |
| AI 协作 | 按平台能力提供 MCP、REST API 或 WebMCP；独立授权、可撤销 |
| 安全变更 | 草稿、差异比较、审核、测试、配置回滚与独立数据恢复 |
| 多站管理 | 可选统一入口，按站隔离数据和权限 |

### 不需要安装：把链接发给 Agent

将下面这段交给 Codex、Claude Code 或其他能够读取 GitHub 和开发网站的 Agent：

```text
请读取 https://github.com/Dreaminmaster/site-control/blob/main/SKILL.md
及其引用的规范，按 Site Control 创建或升级我的网站。
保留已有功能和数据，交付独立管理空间、源码和可验证的 AI 协作能力。
根据实际托管能力实施，报告未实现项，不要伪造接口。
```

已有网站请明确原地升级；多个网站可要求统一管理入口，但站点权限和数据相互隔离。支持本地 Skill 的客户端也可选择安装整个仓库，但不是使用前提。

### 选择合适的等级

| 等级 | 适用场景 |
| --- | --- |
| Lightweight | 静态展示、作品集：源码、配置、版本、部署说明 |
| Managed | 持久化网站、管理应用：增加真实后台、健康检查、配置历史 |
| Collaborative | 多 Agent、私人集成：增加维护接口、最小权限、变更审批和测试 |

### 重要边界

这是开发规范与技能文件，不是现成的管理后台或可直接运行的 MCP 服务器。管理能力由 Agent 在具体网站内实施。第三方 Agent 不会因此获得托管平台的编辑、发布、账户或数据访问权限；需要独立授权并验证支持情况。简单静态网站不应被强行增加服务器和成本。

## English

Site Control is a reusable development and handoff standard for websites, dashboards and web apps. It makes maintainability an explicit deliverable rather than a dependency on the original coding agent.

**Quick start — no installation required:** give a capable coding agent the repository URL and ask it to read [SKILL.md](SKILL.md) and its referenced documents before building or upgrading your site.

```text
Follow https://github.com/Dreaminmaster/site-control/blob/main/SKILL.md
and its references when building or upgrading this website.
Deliver owner-controlled maintenance, editable source, scoped agent access
where supported, and verified acceptance results.
Preserve existing data and integrations. Report unsupported features.
```

The skill scales from lightweight static sites to managed apps and collaborative, multi-agent systems. It requires real authorization, safe configuration changes, source handoff, appropriate testing, and an honest report of hosting limitations. It is not a running control plane, a deployment API, or an automatic permission grant.

## Repository guide / 文件说明

| File | Purpose |
| --- | --- |
| [SKILL.md](SKILL.md) | Agent entry point / 核心执行规范 |
| [AGENTS.md](AGENTS.md) | Link-based agent discovery / Agent 阅读入口 |
| [references/architecture.md](references/architecture.md) | Scope and control workspace |
| [references/security-and-tools.md](references/security-and-tools.md) | Scoped maintenance interfaces and security |
| [references/sites.md](references/sites.md) | ChatGPT Sites host-specific constraints |
| [references/acceptance.md](references/acceptance.md) | Acceptance tests and evidence |
| [assets/manifest.example.json](assets/manifest.example.json) | Non-secret site inventory template |
| [agents/openai.yaml](agents/openai.yaml) | Optional Codex skill metadata |

## Status

v1.0.0 — specification release. No live website implementation or platform compatibility test is implied. Review agent-generated code before deployment. Never include private data, tokens, credentials or session files in this public repository.
