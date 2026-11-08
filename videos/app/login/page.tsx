import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Entrar · VideoVault" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <AuthForm mode="login" />
    </div>
  );
}
