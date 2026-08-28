# MediaMind AI

> AI-powered media intelligence, knowledge management, content generation, and publishing workflow platform.

MediaMind AI is a modern AI-powered workspace designed to help media teams, marketers, content professionals, and communications teams turn organisational knowledge into useful, publishable content.

The platform combines document-based knowledge management, AI-assisted research and content generation, editorial workflows, scheduling, and analytics within a secure workspace-based architecture.

---

## Table of Contents

- [Overview](#overview)
- [Why MediaMind AI](#why-mediamind-ai)
- [Core Features](#core-features)
- [Application Modules](#application-modules)
- [AI & Knowledge Workflow](#ai--knowledge-workflow)
- [Security Architecture](#security-architecture)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Production Build](#production-build)
- [Project Structure](#project-structure)
- [Document Storage](#document-storage)
- [Edge Functions](#edge-functions)
- [Development Status](#development-status)
- [Roadmap](#roadmap)
- [Screenshots](#screenshots)
- [Security Notes](#security-notes)
- [Contributing](#contributing)
- [License](#license)

---

# Overview

MediaMind AI provides a central workspace where users can:

- upload organisational documents;
- build a private knowledge base;
- interact with that knowledge using AI;
- generate media and marketing content;
- create and manage drafts;
- review and approve content;
- schedule posts;
- track activity;
- receive workflow notifications; and
- maintain secure separation between user workspaces.

Instead of treating AI as a standalone chatbot, MediaMind AI connects AI generation to the organisation's own knowledge and content workflow.

The objective is to provide a practical system for moving from:

**Knowledge → AI Assistance → Content Generation → Review → Approval → Scheduling → Publishing**

---

# Why MediaMind AI

Media and marketing teams often work across disconnected tools for:

- document storage;
- research;
- AI generation;
- drafting;
- editorial review;
- content calendars;
- publishing;
- and reporting.

MediaMind AI is being developed to bring these activities into a unified workflow.

The platform is particularly focused on allowing AI-generated content to use selected organisational documents as context rather than relying exclusively on generic model knowledge.

---

# Core Features

## 📚 Knowledge Base

Upload and manage documents that can be used as organisational knowledge.

The Knowledge Base supports the broader AI workflow by allowing relevant documents to provide context for AI-assisted tasks.

Current document workflow includes:

- document upload;
- document metadata storage;
- workspace ownership;
- document processing;
- processing status tracking;
- private storage;
- and AI-accessible document context.

---

## 🤖 AI Assistant

The AI Assistant provides a conversational interface for interacting with workspace knowledge.

Knowledge retrieval is restricted to documents belonging to the authenticated user's authorised workspace.

This allows users to ask questions and work with information contained within their organisation's uploaded documents.

---

## ✨ Content Generator

Generate content using AI with optional Knowledge Base context.

The Content Generator supports multiple content and communication use cases, including formats such as:

- LinkedIn posts;
- Facebook posts;
- X posts;
- X threads;
- Instagram captions;
- press releases;
- newsletters;
- blog articles;
- and sales emails.

Generation controls include options for:

- tone;
- target audience;
- objective;
- output length;
- additional instructions;
- and selected Knowledge Base documents.

Generated content can subsequently enter the draft workflow.

---

## 📝 Draft Management

Generated and manually created content can be managed as drafts.

The draft workflow supports content states such as:

- Draft
- In Review
- Approved
- Published

This provides a foundation for structured editorial review instead of treating AI output as immediately publishable content.

---

## 📅 Calendar & Scheduling

Approved content can move into scheduling workflows.

The Calendar provides visibility into scheduled content and supports the broader transition from content creation to publication planning.

---

## 🔔 Notifications

MediaMind AI includes workflow notifications for important application events.

Notification functionality is integrated into relevant document-processing and content workflows.

---

## 📊 Dashboard

The dashboard provides an operational overview of the workspace.

It surfaces information such as:

- uploaded documents;
- drafts;
- generated posts;
- scheduled posts;
- recent activity;
- recent drafts;
- and recent documents.

---

## 📈 Analytics

The application includes an analytics area intended to provide visibility into media/content activity and performance as the platform evolves.

---

## 💡 Prompt Library

Reusable prompts can be organised within the Prompt Library to help users standardise common AI-assisted workflows.

---

# Application Modules

The current application navigation includes:

| Module | Purpose |
| --- | --- |
| Dashboard | Workspace and activity overview |
| Knowledge Base | Document and organisational knowledge management |
| AI Assistant | AI conversation grounded in workspace knowledge |
| Content Generator | AI-assisted content creation |
| Drafts | Draft review and content workflow |
| Calendar | Scheduled content management |
| Prompt Library | Reusable AI prompt workflows |
| Analytics | Content and media insights |
| Settings | Workspace/application configuration |

---

# AI & Knowledge Workflow

A typical MediaMind AI workflow looks like this:

```text
User
  │
  ▼
Authentication
  │
  ▼
Workspace
  │
  ├──────────────► Knowledge Base
  │                     │
  │                     ▼
  │              Document Processing
  │                     │
  │                     ▼
  │              Knowledge Context
  │                     │
  ▼                     ▼
AI Assistant ◄──── AI / LLM Services
  │                     ▲
  │                     │
  └──────────────► Content Generator
                        │
                        ▼
                      Draft
                        │
                        ▼
                     Review
                        │
                        ▼
                    Approval
                        │
                        ▼
                    Scheduling