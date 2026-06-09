import supabase from './supabase.js'

/**
 * Read persisted state for a detector + entity pair.
 * Returns {} if no state has been stored yet.
 *
 * @param {string} detectorName  e.g. 'competitor_bad_news'
 * @param {string} entityId      e.g. account.id or contact.id
 */
export async function getDetectorState(detectorName, entityId) {
  const { data } = await supabase
    .from('detector_state')
    .select('state')
    .eq('detector_name', detectorName)
    .eq('entity_id', String(entityId))
    .single()
  return data?.state ?? {}
}

/**
 * Upsert persisted state for a detector + entity pair.
 *
 * @param {string} detectorName
 * @param {string} entityId
 * @param {object} state  Plain object — replaces the entire stored state.
 */
export async function setDetectorState(detectorName, entityId, state) {
  const { error } = await supabase
    .from('detector_state')
    .upsert(
      {
        detector_name: detectorName,
        entity_id: String(entityId),
        state,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'detector_name,entity_id' }
    )
  if (error) throw new Error(`detector_state upsert failed: ${error.message}`)
}
