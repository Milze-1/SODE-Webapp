import { redirect } from 'next/navigation';

// Root — middleware handles auth-aware routing;
// this catches any direct visit to /
export default function RootPage() {
  redirect('/login');
}
