# Site Control

> Build websites you can own, operate, and evolve — even after the original AI session ends.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Agent Skill](https://img.shields.io/badge/Agent-Skill-6857c2) ![MCP](https://img.shields.io/badge/MCP-ready%20standard-0969da)

[简体中文](#简体中文) · [English](#english) · [Agent Skill](SKILL.md) · [Architecture](references/architecture.md)

<!-- HUB-PROGRESS:BEGIN -->
## 🚧 Site Control Hub 2.0 · 开发进度 / Roadmap

[![Stage](https://img.shields.io/badge/Hub-2.0%20Alpha-orange)](https://github.com/Dreaminmaster/site-control/pull/1)
[![Build](https://github.com/Dreaminmaster/site-control/actions/workflows/hub-check.yml/badge.svg?branch=feature%2Fsite-control-hub-v2)](https://github.com/Dreaminmaster/site-control/actions?query=branch%3Afeature%2Fsite-control-hub-v2)
![Deployment](https://img.shields.io/badge/Deployment-not%20deployed-lightgrey)
![Migration](https://img.shields.io/badge/Migration-not%20started-lightgrey)

**验收阶段进度：2 / 8（25%）** · Delivery gates, not effort or ETA.

`██░░░░░░`  基础实现、离线测试已通过；HTTP 修复待复验。  
**当前阶段：** 已修复兼容日期、异步错误捕获和 OAuth 资源配置；新增安全加固，等待本地 HTTP 复验。  
**最近核验：** 2026-11-25（Australia/Sydney）；代码快照 `b173dc9`。

| 阶段 / Gate | 进度 | 验收依据 / 下一步 |
| --- | --- | --- |
| 01 基础架构与源码 | 🟢 已完成 | Hub、D1/KV 设计、SDK、后台及 MCP 基础工具已提交 |
| 02 离线测试与构建 | 🟢 已通过 | [11 项测试、双数据库迁移及双 Worker dry-run 构建](https://github.com/Dreaminmaster/site-control/actions/runs/45403865831) |
| 03 HTTP 接口验收 | 🟡 待复验 | [前一轮启动失败](https://github.com/Dreaminmaster/site-control/actions/runs/45406759022)：OAuth Provider 1.x 缺少 canonical resource；已提交修复，[本轮测试](https://github.com/Dreaminmaster/site-control/actions/runs/45407100579) |
| 04 安全与发布准备 | 🟡 进行中 | 新增限流、请求体约束、数据库状态机约束、撤销再检查和过期状态清理；仍需复验、依赖锁定、安全审核、边缘防滥用及备份恢复 |
| 05 Cloudflare 测试部署 | ⚪ 待授权 | 真实 Workers、D1/KV 绑定、服务端 Secrets |
| 06 独立测试站接入 | ⚪ 待部署 | 真实站点注册、持久化、回执、撤销和回滚 |
| 07 统一 OAuth / MCP | ⚪ 待验证 | 真实 GitHub 登录、独立 ChatGPT 会话调用、单次安装后新增站点 |
| 08 现有站点接入 | ⚪ 未开始 | 逐站只读验收、业务适配、安全审核后接入，保留原站 |

<details>
<summary>展开功能进度 / Feature checklist</summary>

| 功能 | 实现 | 真实环境验收 |
| --- | --- | --- |
| GitHub 所有者登录 | 🟢 | ⚪ |
| 站点注册、独立令牌、轮换与撤销 | 🟢 | ⚪ |
| MCP 四个基础工具与逐站读/提案权限 | 🟢 | ⚪ |
| 审批、版本检查、审计、恢复提案 | 🟢 | ⚪ |
| 服务端 SDK 与独立测试站 | 🟢 | ⚪ |
| 业务数据适配与平台兼容验证 | ⚪ | ⚪ |
| 正式部署、独立会话接管 | ⚪ | ⚪ |

🟢 已实现或已通过所列验收；🟡 进行中；🔴 阻塞；⚪ 未完成。代码存在不等于服务已上线。

</details>

**开发入口：** [草稿 PR #1](https://github.com/Dreaminmaster/site-control/pull/1) · [开发分支](https://github.com/Dreaminmaster/site-control/tree/feature/site-control-hub-v2) · [Hub 源码与部署说明](https://github.com/Dreaminmaster/site-control/blob/feature/site-control-hub-v2/hub/README.md) · [接入规范](https://github.com/Dreaminmaster/site-control/blob/feature/site-control-hub-v2/references/hub-v2.md)

> **维护规则：** 在 2.0 完成之前保留本区块。每次有实质性开发、测试、部署或接入进展，维护者同时更新默认分支与开发分支的 README，记录核验日期、证据链接、阻塞和下一步；仅通过明确验收门槛的阶段计入进度。构建徽章自动反映 CI，阶段进度由维护者根据验收证据更新。全部验收通过并正式发布后，可替换为稳定版状态与发布记录。公开 README 不得包含私人站点地址、个人数据或密钥。

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
