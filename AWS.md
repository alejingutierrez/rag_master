# AWS.md - Guia de Despliegue en AWS

## URL de Produccion

**https://fbrwkqtydz.us-east-1.awsapprunner.com**

Servicio AWS App Runner `rag-master` en `us-east-1`. Deploy continuo via GitHub Actions en cada push a `main`.

## Arquitectura AWS

```
[Usuarios] --> [AWS App Runner] --> [Next.js App (Docker)]
                                           |
                    ┌──────────────────────┼──────────────────────┐
                    |                      |                      |
               [AWS S3]          [Amazon RDS]          [Amazon Bedrock]
             (PDFs storage)    (PostgreSQL +           (Titan Embeddings +
                                pgvector)               Claude Opus 4.6)
```

Pipeline de deploy:

```
git push main --> GitHub Actions --> docker build (linux/amd64)
                                          |
                                          v
                                       Amazon ECR (rag-master)
                                          |
                                          v
                                  aws apprunner update-service
                                          |
                                          v
                                  App Runner pull + restart
```

## Prerequisitos en AWS

### 1. Amazon RDS - PostgreSQL con pgvector

**Crear instancia RDS:**
- Engine: PostgreSQL 15+
- Instance class: db.t3.micro (desarrollo) o db.r6g.large (produccion)
- Storage: 20 GB gp3
- VPC: Misma VPC que el frontend
- Security group: permitir puerto 5432 desde el frontend

**Habilitar pgvector:**
```sql
-- Conectarse a la instancia RDS y ejecutar:
CREATE EXTENSION IF NOT EXISTS vector;
```

**Ejecutar migracion inicial:**
```bash
# Opcion 1: Usar Prisma
npx prisma db push

# Opcion 2: Ejecutar SQL manualmente
psql -h <rds-endpoint> -U postgres -d rag_master -f prisma/migrations/00_init/migration.sql
```

**Variable de entorno:**
```
DATABASE_URL=postgresql://postgres:<password>@<rds-endpoint>:5432/rag_master
```

### 2. Amazon S3 - Almacenamiento de PDFs

**Crear bucket:**
```bash
aws s3 mb s3://rag-master-pdfs --region us-east-1
```

**Configurar CORS (si el frontend es externo):**
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": []
    }
  ]
}
```

**Variable de entorno:**
```
S3_BUCKET_NAME=rag-master-pdfs
```

### 3. Amazon Bedrock - Embeddings y LLM

**Habilitar modelos en Bedrock:**
1. Ir a Amazon Bedrock > Model access
2. Solicitar acceso a:
   - **Amazon Titan Text Embeddings V2** (`amazon.titan-embed-text-v2:0`)
   - **Anthropic Claude Opus 4.6** (`us.anthropic.claude-opus-4-6-20250610-v1:0`)
3. Esperar aprobacion (puede tardar minutos u horas)

**Variables de entorno:**
```
BEDROCK_CLAUDE_MODEL_ID=us.anthropic.claude-opus-4-6-20250610-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0
```

> **Nota**: Si Claude Opus 4.6 no esta disponible en tu region, puedes usar:
> - `us.anthropic.claude-sonnet-4-20250514-v1:0` (Sonnet 4)
> - `anthropic.claude-3-5-sonnet-20241022-v2:0` (Sonnet 3.5)

### 4. IAM - Permisos

**Politica IAM minima para las credenciales:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::rag-master-pdfs/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.*"
      ]
    }
  ]
}
```

## Despliegue Actual: AWS App Runner + ECR + GitHub Actions

El proyecto se despliega automaticamente en App Runner con el workflow `.github/workflows/deploy.yml`. No se usa Amplify (la app `d2sayha59t6h2h` quedo en estado FAILED y esta inactiva).

### Recursos en AWS

| Recurso | Identificador |
|---------|---------------|
| App Runner Service | `rag-master` (ARN: `arn:aws:apprunner:us-east-1:741448945431:service/rag-master/d8fd8b57f0ef41eda8deaf856697bb65`) |
| URL publica | `https://fbrwkqtydz.us-east-1.awsapprunner.com` |
| ECR Repository | `741448945431.dkr.ecr.us-east-1.amazonaws.com/rag-master` |
| IAM Role (ECR access) | `AppRunnerECRAccessRole` |

### Flujo de despliegue

1. Push a `main` -> dispara `.github/workflows/deploy.yml`.
2. Build de imagen Docker (`--platform linux/amd64 --provenance=false`).
3. Push a ECR con tags `:<commit-sha>` y `:latest`.
4. `aws apprunner update-service` con la nueva imagen.
5. App Runner hace pull, reinicia el contenedor y vuelve a `RUNNING`.

El contenedor ejecuta `node server.js` (Next.js standalone build) en el puerto 3000 y aplica migraciones al startup via `scripts/apply-migrations.js` (configurado en el `Dockerfile`).

### Variables de entorno en App Runner

Se inyectan desde GitHub Secrets en el paso `update-service`:

- `DATABASE_URL`
- `S3_BUCKET_NAME`
- `AWS_REGION`, `APP_AWS_ACCESS_KEY_ID`, `APP_AWS_SECRET_ACCESS_KEY`
- `BEDROCK_CLAUDE_MODEL_ID`, `BEDROCK_EMBEDDING_MODEL_ID`
- `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`

### Deploy manual (sin GitHub Actions)

```bash
# Build local y push a ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 741448945431.dkr.ecr.us-east-1.amazonaws.com

docker build --platform linux/amd64 --provenance=false \
  -t 741448945431.dkr.ecr.us-east-1.amazonaws.com/rag-master:latest .
docker push 741448945431.dkr.ecr.us-east-1.amazonaws.com/rag-master:latest

# Forzar despliegue de :latest
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:us-east-1:741448945431:service/rag-master/d8fd8b57f0ef41eda8deaf856697bb65
```

### Operaciones comunes

```bash
# Estado del servicio
aws apprunner describe-service \
  --service-arn arn:aws:apprunner:us-east-1:741448945431:service/rag-master/d8fd8b57f0ef41eda8deaf856697bb65 \
  --query 'Service.Status'

# Logs (CloudWatch)
aws logs tail /aws/apprunner/rag-master/<service-id>/application --follow
```

## Opciones alternativas (no usadas)

Conservadas como referencia. La produccion vive en App Runner.

### EC2 con Docker

```bash
docker build -t rag-manager .
docker run -p 3000:3000 --env-file .env rag-manager
```

### ECS Fargate

1. Crear ECR repository (ya existe: `rag-master`).
2. Push imagen Docker a ECR.
3. Crear ECS cluster con Fargate.
4. Crear Task Definition con variables de entorno.
5. Crear Service con ALB.

### AWS Amplify

App `d2sayha59t6h2h` quedo creada pero sus deploys fallan (Next.js 16 + Prisma + Docker no encaja bien con el runtime de Amplify SSR). Se mantiene por historico, no es la ruta activa.

## Costos Estimados (Mensuales)

| Servicio | Especificacion | Costo Estimado |
|----------|---------------|----------------|
| RDS PostgreSQL | db.t3.micro | ~$15-25 |
| S3 | 10 GB storage | ~$0.25 |
| Bedrock Embeddings | ~100k embeddings | ~$2 |
| Bedrock Claude | ~5k llamadas | ~$10-50 |
| Amplify Hosting | Build + hosting | ~$5-10 |
| **Total** | | **~$35-90/mes** |

## Seguridad

- **Nunca** subir el archivo `.env` a Git
- Usar IAM roles en vez de access keys cuando sea posible (especialmente en EC2/ECS)
- Habilitar encryption at rest en RDS y S3
- Restringir security groups al minimo necesario
- Rotar credenciales periodicamente

## Troubleshooting

### Error: pgvector extension not found
```sql
-- Verificar que PostgreSQL 15+ esta instalado
SELECT version();
-- Instalar extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: Bedrock model access denied
- Verificar que los modelos estan habilitados en Bedrock > Model access
- Verificar que la region es correcta (us-east-1)
- Verificar permisos IAM

### Error: S3 access denied
- Verificar que el bucket existe
- Verificar permisos IAM para s3:PutObject, s3:GetObject, s3:DeleteObject
- Verificar que la region del bucket coincide con AWS_REGION

### Error: Connection refused (RDS)
- Verificar security group permite conexiones desde el origen
- Verificar que el endpoint RDS es correcto
- Verificar que la base de datos `rag_master` existe
