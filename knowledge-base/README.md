# Knowledge base

Project documentation for the custom-design e-commerce platform: a single business with a storefront and an admin dashboard. The working brand name "Crimsonne" is a placeholder.

| Document | What it covers |
|---|---|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Phase status, evidence, known gaps. **Start here.** |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Decisions made and questions still open |
| [REFERENCE_ANALYSIS.md](REFERENCE_ANALYSIS.md) | DropX and Bookly analysis, licences, what was reused |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Topology, packages, key decisions, request flow |
| [DATABASE.md](DATABASE.md) · [ERD.md](ERD.md) | Schema conventions, constraints, migrations, backups |
| [RBAC.md](RBAC.md) | Permissions, role matrix, escalation rules, isolation |
| [AUTHENTICATION.md](AUTHENTICATION.md) | Clerk sign-in, linking Clerk users to our users, staff invitations |
| [SECURITY.md](SECURITY.md) | Controls in place and planned |
| [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md) | Tokens, contrast rules, typography, layout |
| [TESTING.md](TESTING.md) | Test layers, test DB, latest results |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Railway setup, migration flow, rollback |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | Every variable and where it's used |

Written in the phase that builds them: PRD, API_DOCUMENTATION, PAYMENT_FLOW, ORDER_WORKFLOW, DESIGN_CUSTOMIZATION.

Claims are tagged `[fact]` (verified in code or by a run), `[assumption]` or `[proposed]`.
