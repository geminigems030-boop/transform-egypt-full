import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center pt-20">
      <div className="text-center max-w-md px-4">
        <h1 className="font-serif text-8xl text-gold mb-4">404</h1>
        <h2 className="font-serif text-3xl mb-6">Page Not Found</h2>
        <p className="text-gray-400 font-light mb-8">
          The luxury experience you are looking for seems to have moved or does not exist.
        </p>
        <Link href="/">
          <Button variant="secondary" size="lg">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
