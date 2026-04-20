# Product Triage & Workflow System

An AI-powered system that analyzes products (via UPC) through a multi-stage workflow to determine optimal refurbishment strategies, profitability metrics, and decision recommendations.

## Overview

This application processes product information through an intelligent pipeline:
1. **RAW**: Product submission via UPC
2. **ENRICHED**: AI-powered product data generation using Google Gemini
3. **TRIAGE**: Decision engine (REFURBISH/HARVEST/SCRAP) based on product condition and value
4. **GAINS**: Profit analysis and market assessment
5. **SUMMARY**: Business-friendly summary of the decision and rationale

The system uses an event-driven architecture with Kafka for asynchronous processing and PostgreSQL for state management.

## Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (async SQLAlchemy ORM)
- **Message Queue**: Kafka (via Redpanda)
- **AI**: Google Generative AI (Gemini)
- **Server**: Uvicorn

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Next.js built-in

### Infrastructure
- **Container Runtime**: Docker & Docker Compose
- **Services**: Redpanda (Kafka), PostgreSQL

## Project Structure

```
project-root/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py              # Main API router
│   │   │   ├── deps.py                # Dependency injection
│   │   │   └── routes/
│   │   │       ├── produce.py         # UPC submission endpoint
│   │   │       ├── workflow.py        # Workflow retrieval endpoint
│   │   │       └── replay.py          # Replay & rerun endpoints
│   │   ├── models/
│   │   │   ├── product.py            # ProductSummary ORM model
│   │   │   └── workflow.py           # WorkflowEvent ORM model
│   │   ├── schemas/
│   │   │   ├── upc.py                # UPC request schema
│   │   │   └── replay.py             # Replay/rerun request schemas
│   │   ├── services/
│   │   │   ├── enrichment_service.py # Product data generation
│   │   │   ├── triage_service.py     # Decision engine
│   │   │   ├── gains_service.py      # Profit analysis
│   │   │   ├── summary_service.py    # Summary generation
│   │   │   ├── workflow_service.py   # Workflow retrieval & repair
│   │   │   ├── replay_service.py     # Replay history & rerun logic
│   │   │   └── email_service.py      # Email notifications
│   │   ├── db/
│   │   │   └── database.py           # Database connection & schema
│   │   ├── kafka/
│   │   │   └── producer.py           # Kafka event producer
│   │   └── main.py                   # FastAPI app & consumer startup
│   ├── consumers/
│   │   ├── enrichment_consumer.py    # Listens to raw_events
│   │   ├── triage_consumer.py        # Listens to enriched_events
│   │   ├── gains_consumer.py         # Listens to triage_events
│   │   └── notifier_consumer.py      # Listens to gains_events
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # Home page with workflow UI
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles
│   │   ├── api/                      # Backend API routes
│   │   └── components/               # React components
│   │       ├── InputSection.tsx      # UPC input form
│   │       ├── WorkflowList.tsx      # Workflow list display
│   │       └── ReplayHistoryModal.tsx# Replay history modal
│   ├── lib/
│   │   ├── api.ts                    # API client functions
│   │   ├── types.ts                  # TypeScript type definitions
│   │   └── storage.ts                # Local storage utilities
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── README.md
```

## Key Features

### Product Workflow Processing
- **UPC-based submission**: Submit products via Universal Product Code
- **Multi-stage pipeline**: RAW → ENRICHED → TRIAGE → GAINS → SUMMARY
- **Event-driven architecture**: Asynchronous processing via Kafka
- **State repair**: Automatic workflow repair for missing run IDs and deduplication

### Decision Engine
- **Three decision options**:
  - `REFURBISH`: Full refurbishment and resale
  - `HARVEST`: Component harvesting
  - `SCRAP`: Disposal/recycling
- **AI-powered reasoning**: Uses Gemini to evaluate product condition, price, and market factors
- **Fallback logic**: Deterministic defaults when AI unavailable

### Profit Analysis
- **Market demand assessment**: HIGH/MEDIUM/LOW
- **Resale potential**: EXCELLENT/GOOD/FAIR/POOR
- **Refurbishment complexity**: LOW/MEDIUM/HIGH
- **ROI projection**: Expected return on investment (0-300%)

### Frontend Features
- **Real-time workflow tracking**: Auto-refresh for in-flight runs every 2.5 seconds
- **Workflow history**: View complete event timeline for each product
- **Replay capability**: Review historical processing runs
- **Rerun ability**: Reprocess products with new conditions
- **UPC persistence**: Local storage of known UPCs

## API Endpoints

### Core Endpoints
- `POST /produce` - Submit a new product via UPC
  - Request: `{ "upc": "string" }`
  - Returns: Event created with RAW stage

- `GET /workflow/{upc}` - Retrieve workflow history
  - Returns: Array of workflow events with payloads

- `POST /replay` - Retrieve specific run history
  - Request: `{ "upc": "string", "run_id": "string" }`
  - Returns: Event history for the run

- `POST /rerun` - Reprocess a product from ENRICHED stage
  - Request: `{ "upc": "string", "run_id": "string" }`
  - Returns: New run ID and product condition

### Health Check
- `GET /` - API status
  - Returns: `{ "status": "ok" }`

## Workflow Stages & Consumers

### RAW → ENRICHED (enrichment_consumer)
Generates product data using Google Gemini based on UPC.
- Input: UPC
- Output: Product name, category, brand, estimated price

### ENRICHED → TRIAGE (triage_consumer)
Determines optimal product disposition.
- Input: Product data + condition
- Output: Decision (REFURBISH/HARVEST/SCRAP) + profit estimates

### TRIAGE → GAINS (gains_consumer)
Analyzes profit potential and market conditions.
- Input: Product + decision
- Output: Market demand, resale potential, complexity, ROI

### GAINS → SUMMARY (notifier_consumer)
Generates business summary and sends notifications.
- Input: Product + decision + gains
- Output: Summary text + email notification

## Setup & Deployment

### Prerequisites
- Docker & Docker Compose
- Python 3.9+ (for local backend development)
- Node.js 18+ (for local frontend development)
- Google Generative AI API key

### Environment Variables
Create `.env` file in project root:
```bash
# Google AI
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite-preview

# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5433/triage_db

# Kafka
KAFKA_BROKERS=localhost:9092

# Optional
RUN_CONSUMERS_IN_API=true  # Run consumers in API process vs separately
```

### Docker Compose

Start all services:
```bash
docker-compose up -d
```

This launches:
- **Redpanda** (Kafka): Port 9092
- **PostgreSQL**: Port 5433

### Backend Development

1. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Initialize database:
   ```bash
   cd backend
   python -m app.db.database  # Creates schema
   ```

3. Run the server:
   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

Backend available at: `http://localhost:8000`

### Frontend Development

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

Frontend available at: `http://localhost:3000`

## Database Schema

### WorkflowEvent
```sql
CREATE TABLE workflow_events (
  id UUID PRIMARY KEY,
  upc VARCHAR NOT NULL,
  run_id VARCHAR,
  stage VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### ProductSummary
```sql
CREATE TABLE products_summary (
  upc VARCHAR PRIMARY KEY,
  final_decision VARCHAR,
  estimated_profit FLOAT,
  summary TEXT,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

## Configuration

### Consumers
Control consumer execution via `RUN_CONSUMERS_IN_API`:
- `true` (default): Run all 4 consumers in the API process
- `false`: Run consumers separately for scalability

### Gemini Model
Set `GEMINI_MODEL` to any available Gemini model:
- Default: `gemini-3.1-flash-lite-preview`
- Options: `gemini-2.0-flash`, `gemini-1.5-pro`, etc.

## Data Flow Example

1. **User submits UPC via frontend**
   ```
   POST /produce with UPC "012345678901"
   ```

2. **Backend creates RAW event and publishes to Kafka**
   - WorkflowEvent created with stage="RAW"
   - Event published to `raw_events` topic

3. **enrichment_consumer processes**
   - Calls Gemini to generate product data
   - Creates ENRICHED event with product details
   - Publishes to `enriched_events` topic

4. **triage_consumer processes**
   - Calls Gemini with product data + condition
   - Generates decision (REFURBISH/HARVEST/SCRAP)
   - Creates TRIAGE event with decision
   - Publishes to `triage_events` topic

5. **gains_consumer processes**
   - Analyzes profit potential
   - Creates GAINS event with market metrics
   - Publishes to `gains_events` topic

6. **notifier_consumer processes**
   - Generates summary text via Gemini
   - Creates SUMMARY event
   - Sends email notification (if configured)
   - Updates products_summary table

7. **Frontend auto-refreshes workflow**
   - Fetches updated events every 2.5s
   - Detects completion when SUMMARY event present
   - Displays full timeline to user

## Troubleshooting

### Consumers Not Processing
- Check `RUN_CONSUMERS_IN_API=true` is set
- Verify Kafka is running: `docker ps | grep redpanda`
- Check logs: `docker-compose logs`

### Gemini API Errors
- Verify `GOOGLE_API_KEY` is set and valid
- Check quota limits in Google Cloud Console
- Ensure model name matches available models

### Database Connection Issues
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check `DATABASE_URL` format and credentials
- Ensure port 5433 is accessible (or update in docker-compose.yml)

### Frontend Can't Reach Backend
- Ensure backend is running on `http://localhost:8000`
- Check CORS configuration in FastAPI
- Verify API calls use correct endpoint URLs

## Performance & Scaling

### Current Architecture
- Single API process with embedded consumers
- Suitable for development and small workloads

### Scaling Options
1. **Separate consumer processes**: Set `RUN_CONSUMERS_IN_API=false` and run consumers independently
2. **Multiple API instances**: Use a load balancer (nginx, HAProxy)
3. **Consumer scaling**: Run multiple consumer instances per Kafka consumer group
4. **Database optimization**: Add indexes on frequent queries (upc, run_id, timestamp)

## Contributing

1. Create a feature branch
2. Make changes following the existing patterns
3. Test API endpoints and workflow completion
4. Update documentation as needed
5. Submit PR

## License

Proprietary - All rights reserved

## Support

For issues, bugs, or feature requests, please contact the development team.
