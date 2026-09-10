import { evaluateRegex } from '../utils/regexEngine'
import type { RegexDocument } from '../utils/regex'
self.onmessage = async (event: MessageEvent<{ id: number; document: RegexDocument }>) => {
  self.postMessage({ id: event.data.id, result: await evaluateRegex(event.data.document) })
}
