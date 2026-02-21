📌 Project Overview

TransitLink is a software-only smart transit platform designed to modernize public transportation access through digital fare management, account pooling, fraud detection, and AI-driven transit assistance.

The platform replaces fragmented fare payment systems with a unified application that enables:

* Account-based digital fare storage

* Family and community fare pooling

* Peer-to-peer transit credit gifting

* NFC-based digital ticket validation

* Fraud-aware fare monitoring

* AI-powered transit assistance using a local Large Language Model (LLM)

Our team adopted a modular three-tier software architecture to ensure scalability, maintainability, and separation of concerns across the presentation, business logic, and data access layers.

🧠 System Architecture

The system follows a layered architecture:

Presentation Layer (Frontend)
        ↓
Application Layer (API Backend)
        ↓
Business Logic Layer (Transit Services)
        ↓
Data Layer (Persistence + Integrations)
        ↓
MCP Server (AI Service Interface)
        ↓
Local LLM (Offline Transit Assistant)

The Model Context Protocol (MCP) Server acts as a bridge between the backend services and the locally hosted LLM, allowing AI-driven fare assistance, fraud analysis, and intelligent system interactions without relying on cloud APIs.

📁 Repository Structure

```tex
transitlink/
├── client/                      # Frontend (React + Vite + Tailwind)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                      # Backend (Express.js)
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/            # Business Logic Layer
│   │   ├── data/
│   │   ├── integrations/
│   │   └── config/
│   └── package.json
│
├── mcp-server/                  # MCP Interface Layer
│   ├── tools/
│   ├── resources/
│   └── server.py
│
├── docs/                        # Architecture + API Docs
│   ├── architecture.md
│   ├── api.md
│   └── database.md
│
├── .github/
├── README.md
└── package.json
```
🧩 Core Functional Modules

| Module                  | Description                           |
| ----------------------- | ------------------------------------- |
| **Digital Fare Wallet** | Stores user transit credits digitally |
| **Fare Pooling**        | Enables shared transit accounts       |
| **Fare Gifting**        | Peer-to-peer credit transfers         |
| **Fraud Monitoring**    | Detects abnormal usage patterns       |
| **Transit History**     | Maintains usage logs                  |
| **Admin Controls**      | Manages system-wide policies          |
| **AI Assistant**        | Provides transit insights via LLM     |

🤖 MCP Server + Local LLM Integration

TransitLink incorporates an MCP-based AI service layer that enables:

* Offline AI fare analysis

* Context-aware user assistance

* Fraud pattern interpretation

* Usage-based transit recommendations

The MCP server exposes structured system tools and resources such as:

transit://fare/history/{user_id}
transit://pool/status/{pool_id}
transit://fraud/alerts/{account_id}

These resources allow the local LLM to:

* Interpret transit usage behavior

* Provide fare optimization suggestions

* Assist administrators in monitoring anomalies

All inference is performed locally using a self-hosted LLM, ensuring privacy-preserving intelligent support without cloud dependencies.

🛠️ Tech Stack

| Layer    | Technology                     |
| -------- | ------------------------------ |
| Frontend | React, Vite, TailwindCSS       |
| Backend  | Node.js, Express.js            |
| AI Layer | MCP Server, Local LLM (Ollama) |
| Database | SQLite / MongoDB               |
| DevOps   | GitHub Actions                 |

🚀 Setup Instructions
Frontend

cd client
npm install
npm run dev

Backend

cd server
npm install
node index.js

MCP Server

cd mcp-server
python server.py


