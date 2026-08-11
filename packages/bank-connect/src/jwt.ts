import { importPKCS8, SignJWT } from "jose";

export async function createEnableBankingJwt(
  applicationId: string,
  privateKeyPem: string,
): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
      kid: applicationId,
    })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}
