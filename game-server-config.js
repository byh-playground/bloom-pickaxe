export async function loadGameServer() {
    const url = new URL('./online-endpoint.json', import.meta.url);
    // Pages caches stable paths. The server address can change independently of the client bundle.
    url.searchParams.set('v', String(Date.now()));
    try {
        const response = await fetch(url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) return null;
        const config = await response.json();
        return typeof config?.gameServer === 'string' ? config.gameServer : null;
    } catch {
        return null;
    }
}
