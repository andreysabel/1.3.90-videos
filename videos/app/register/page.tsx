import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Crear cuenta · VideoVault" };

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <AuthForm mode="register" />
    </div>
  );
}
