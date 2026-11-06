import Image from "next/image";
import Link from "next/link";

export function BrandLockup() {
  return <div className="auth-brand-lockup">
    <Link href="/" aria-label="Renaissance Innovation Labs home"><Image src="/logo/blackLogo.svg" alt="Renaissance Innovation Labs" width={100} height={45} priority /></Link>
    <p>Marketing workspace</p>
  </div>;
}
