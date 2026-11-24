let channelSequence = 0;

/**
 * `RealtimeClient.channel()` devolve o canal existente quando o topic repete
 * (realtime-js 2.x) e `RealtimeChannel.on()` lanca depois do `subscribe()`:
 * "cannot add `postgres_changes` callbacks ... after `subscribe()`".
 *
 * Topic fixo, entao, quebra quando dois componentes (ou duas montagens do mesmo
 * hook) usam o canal ao mesmo tempo — a segunda chamada a `.on()` derruba a
 * arvore do React. Cada montagem precisa do seu proprio topic.
 */
export function uniqueTopic(base: string): string {
  channelSequence += 1;
  return `${base}-${channelSequence}`;
}