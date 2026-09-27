# IONOS Deployment

Pushes to `main` deploy this static site to Justin's existing IONOS hosting over SFTP.

Required GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `IONOS_SSH_HOST` | IONOS SSH/SFTP host name |
| `IONOS_SSH_USER` | IONOS SSH/SFTP user |
| `IONOS_SSH_PORT` | SSH port, usually `22` |
| `IONOS_SSH_KEY` | Private deployment key with access to the IONOS web space |
| `IONOS_KNOWN_HOSTS` | Pinned SSH host key line for the IONOS host |
| `IONOS_SITE_PATH` | Absolute remote directory for the public site root |

The deploy intentionally excludes `scan/` and `up/` from deletion or upload because those folders are managed by ScanApp and the review/upload service.
