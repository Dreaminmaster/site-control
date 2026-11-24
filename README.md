# Site Control

> Build websites you can own, operate, and evolve — even after the original AI session ends.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Agent Skill](https://img.shields.io/badge/Agent-Skill-6857c2) ![MCP](https://img.shields.io/badge/MCP-ready%20standard-0969da)

[简体中文](#简体中文) · [English](#english) · [Agent Skill](SKILL.md) · [Architecture](references/architecture.md)

## Site Control Hub 2.0 (alpha preview)

开发中的 [Hub 实现](hub/README.md) 和 [统一接入协议](references/hub-v2.md) 旨在通过一个 MCP + 独立网站令牌管理多个网站。当前源码尚未完成部署、安全审核、端到端 OAuth/MCP 验证；不能声称已接通任何现有站点。原 v1 规范仍然适用。

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
