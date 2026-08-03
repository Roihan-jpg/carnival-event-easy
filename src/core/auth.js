import { getSupabaseClient } from '../services/supabase.js';
import { mapProfile } from '../services/mappers.js';
import { clearQueryCache } from '../services/dataService.js';
import { toUserMessage } from '../utils/errors.js';
import { setState } from './state.js';

let authSubscription;

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Konfigurasi Supabase belum tersedia.');
  return client;
}

async function readActiveProfile(userId) {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role, is_active, created_at, updated_at')
    .eq('id', userId)
    .single();
  if (error) throw new Error(toUserMessage(error));
  if (!data.is_active) {
    await client.auth.signOut();
    throw new Error('Akun Anda tidak aktif. Hubungi Super Admin.');
  }
  return mapProfile(data);
}

export async function restoreSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    setState({ user: null, authReady: true, sessionMessage: 'Sesi Anda telah berakhir. Silakan masuk kembali.' });
    return null;
  }
  if (!data.session?.user) {
    setState({ user: null, authReady: true });
    bindAuthEvents();
    return null;
  }
  try {
    const profile = await readActiveProfile(data.session.user.id);
    setState({ user: profile, authReady: true, sessionMessage: '' });
    bindAuthEvents();
    return profile;
  } catch (profileError) {
    await client.auth.signOut();
    setState({ user: null, authReady: true, sessionMessage: profileError.message });
    bindAuthEvents();
    return null;
  }
}

export async function signIn(email, password) {
  if (!email?.trim() || !password) throw new Error('Email dan kata sandi wajib diisi.');
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.status === 400) throw new Error('Email atau kata sandi tidak sesuai.');
    throw new Error(toUserMessage(error));
  }
  try {
    clearQueryCache();
    const profile = await readActiveProfile(data.user.id);
    setState({ user: profile, sessionMessage: '' });
    await client.rpc('record_login');
    return profile;
  } catch (profileError) {
    await client.auth.signOut();
    throw profileError;
  }
}

export async function requestPasswordReset(email) {
  if (!email?.trim()) throw new Error('Isi email terlebih dahulu.');
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(toUserMessage(error));
}

export async function updatePassword(password) {
  if (!password || password.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(toUserMessage(error));
  await signOut();
}

export async function changePassword(password) {
  if (!password || password.length < 8) throw new Error('Kata sandi baru minimal delapan karakter.');
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(toUserMessage(error));
}

export async function signOut() {
  const client = requireClient();
  await client.auth.signOut();
  clearQueryCache();
  setState({ user: null, mobileMenuOpen: false, sessionMessage: '', activeEvent: null });
}

function bindAuthEvents() {
  if (authSubscription) return;
  const client = requireClient();
  const { data } = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearQueryCache();
      setState({
      user: null,
      mobileMenuOpen: false,
      activeEvent: null,
      sessionMessage: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      });
    }
  });
  authSubscription = data.subscription;
}
