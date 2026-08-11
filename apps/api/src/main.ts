import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function getCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim());
  if (fromEnv?.length) {
    return fromEnv;
  }

  const origins = ["http://localhost:3000"];
  if (process.env.WEB_URL) {
    origins.push(process.env.WEB_URL);
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`Póca API running on http://localhost:${port}`);
}

bootstrap();
