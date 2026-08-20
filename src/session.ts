const SESSION_STORAGE_KEY = 'yapfeed.session.id';
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export interface SessionStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getOrCreateSessionId(
  storage: SessionStoragePort,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = storage.getItem(SESSION_STORAGE_KEY);
  if (existing !== null && UUID_PATTERN.test(existing)) return existing;

  const id = createId();
  if (!UUID_PATTERN.test(id)) throw new Error('The browser could not create a valid listening session.');
  storage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export async function hashSessionId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
