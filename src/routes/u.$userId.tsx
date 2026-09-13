/**
 * Perfil de outro usuário — rota fina que renderiza o PERFIL UNIFICADO
 * (ProfileView) parametrizado pelo id da URL. Mantida para preservar deep
 * links já compartilhados de `/u/:id`; o visual/experiência é o mesmo do
 * `/perfil` (decisão: um perfil só).
 */
import { createFileRoute } from "@tanstack/react-router";
import { StatusBar } from "@/components/StatusBar";
import { ProfileView } from "@/routes/profile-view";

export const Route = createFileRoute("/u/$userId")({
  component: PublicProfilePage,
  head: () => ({
    meta: [
      { title: "Perfil — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PublicProfilePage() {
  const { userId } = Route.useParams();
  return (
    <div className="pb-16">
      <StatusBar />
      <ProfileView viewedUserId={userId} />
    </div>
  );
}
