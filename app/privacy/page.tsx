import { Metadata } from "next";
import PrivacyRights from "@/components/privacy/PrivacyRights";

export const metadata: Metadata = {
  title: "Privacy Rights | Your Data",
  description: "Manage your privacy rights and data preferences",
};

export default function PrivacyPage() {
  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Your Privacy Rights</h1>
        <p className="text-muted-foreground mb-8">
          We respect your privacy and are committed to protecting your personal data. 
          This page allows you to exercise your rights under data protection laws such as GDPR and CCPA.
        </p>
        
        <PrivacyRights />
      </div>
    </div>
  );
} 