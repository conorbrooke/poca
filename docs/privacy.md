# Privacy Policy — Póca

**Last updated:** August 2026

Póca is open-source personal finance software that you run yourself. This policy describes how the application handles data when you self-host it.

## Summary

- You run Póca on your own machine or server.
- Your financial data is stored in your local PostgreSQL database.
- Bank connections use [Enable Banking](https://enablebanking.com/) (PSD2 Open Banking).
- The Póca project does not operate a hosted service and does not receive your data.

## Data we collect

When you self-host Póca, **no data is sent to the Póca project or its contributors**. All data stays under your control:

| Data | Where it is stored |
|------|-------------------|
| Bank account balances and transactions | Your local PostgreSQL database |
| Bank connection credentials | Your `.env` file and Enable Banking session |
| Enable Banking private key (`.pem`) | Your local filesystem |

## Enable Banking

To connect bank accounts, you register your own application with Enable Banking and configure Póca with your credentials. Enable Banking acts as the regulated intermediary between Póca and your bank under PSD2.

Enable Banking’s own privacy practices apply to their service. See [Enable Banking](https://enablebanking.com/) for their policies.

## Data sharing

Póca does not sell, rent, or share your financial data with third parties. Data leaves your machine only when:

1. **You authorise a bank connection** — Póca requests account information from your bank via Enable Banking.
2. **You choose to deploy elsewhere** — e.g. if you host Póca on a cloud server you control.

## Security

You are responsible for securing your self-hosted instance, including:

- Keeping your `.pem` key and `.env` file private
- Not committing secrets to version control
- Securing your database and server if deployed beyond localhost

## Your rights

Because you self-host Póca, you have full control over your data. You can export, modify, or delete it at any time by managing your database directly.

## Contact

For privacy questions about this project, open an issue on the GitHub repository or contact the maintainer via the email listed in the repository.

## Changes

This policy may be updated as the project evolves. The latest version is always available in the project repository.
