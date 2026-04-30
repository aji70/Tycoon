import PublicPlayerProfile from '@/components/profile/PublicPlayerProfile';

export default function PublicUserPage({ params }: { params: { username: string } }) {
  const username = decodeURIComponent(params.username || '');
  return (
    <main className="w-full min-h-screen">
      <PublicPlayerProfile username={username} />
    </main>
  );
}
