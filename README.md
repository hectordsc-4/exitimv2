# EXI

Sistema local: **PostgreSQL + FastAPI + HTML/CSS/JS**.

## Estructura

```
EXI/
├── backend/          # FastAPI
├── frontend/         # Login HTML/CSS/JS
├── database/         # Scripts SQL y arranque Postgres
└── tools/            # PostgreSQL portable + datos (local)
```

## Credenciales PostgreSQL (local)

| Campo | Valor |
|-------|-------|
| Host | `localhost` |
| Puerto | `5432` |
| Usuario | `postgres` |
| Contraseña | `exi_local_2026` |
| Base de datos | `exi_db` |

## Arranque

```powershell
# 1) Arrancar PostgreSQL (la primera vez inicializa el cluster)
cd D:\EXI\database
.\start_postgres.ps1

# 2) Crear tablas y datos de prueba (solo la primera vez)
.\init_db.ps1

# 3) Arrancar API + frontend
cd D:\EXI\backend
.\start_api.ps1
```

Abre: **http://127.0.0.1:8000**

Docs Swagger: **http://127.0.0.1:8000/docs**

### Usuarios de prueba

| Usuario | Contraseña |
|---------|------------|
| `admin` | `admin123` |
| `demo`  | `demo123`  |

Si el login es correcto, se inserta un registro en `exi_logins` (IP + dispositivo + fecha).

## DBeaver

1. Nueva conexión → PostgreSQL  
2. Host `localhost`, puerto `5432`, DB `exi_db`  
3. User `postgres`, password `exi_local_2026`  
4. Explorar tablas `exi_usuarios`, `exi_logins`, `exi_permisos`, `exi_permisos_usuario`

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login + alta en `exi_logins` |
| GET/POST | `/api/usuarios` | Listar / crear usuarios |
| GET/PUT/DELETE | `/api/usuarios/{cod}` | Obtener / actualizar / baja |
| GET | `/api/logins` | Últimos logins |
| GET/POST | `/api/permisos` | Catálogo de permisos |
| GET/POST/DELETE | `/api/permisos-usuario` | Asignación usuario-permiso |

## Notas

- Las contraseñas están en texto plano de momento (como en el diseño original). Más adelante se pueden hashear.
- PostgreSQL va embebido en `tools/pgsql` (portable). Para detenerlo: `database\stop_postgres.ps1`.
- Cuando subas al VPS, cambia `DATABASE_URL` en `backend/.env` y despliega backend + frontend allí.
