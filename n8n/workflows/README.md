# Workflows de n8n

Exportá cada workflow desde n8n (menú `...` → **Download**) y guardalo acá.

Antes de hacer commit, revisá el JSON: los workflows exportados **no incluyen
credenciales**, pero sí pueden tener datos fijados (*pinned data*) con información
personal, números de teléfono o IDs. Desfijá los datos antes de exportar.

Conexión a Postgres desde n8n:
- Si usás el n8n del proyecto (`--profile n8n`): host `postgres`, puerto `5432`.
- Si usás un n8n que ya tenías en otro contenedor: host `host.docker.internal`,
  puerto `5433` (el valor de `POSTGRES_PORT`).
