import { NextResponse } from 'next/server'
import apiUtils from '../../../lib/apiUtils'
import supabase from '../../../lib/supabase'

export async function GET() {
  try {
    // lightweight DB ping
    const { data, error } = await supabase.rpc('version').select?.() || { data: null, error: null }
    // Not all Supabase projects have a version RPC; ignore error and respond OK if DB reachable
    return NextResponse.json(apiUtils.okPayload({ status: 'ok', db_ok: error ? false : true }), { headers: apiUtils.CORS_HEADERS })
  } catch (e) {
    return NextResponse.json(apiUtils.errorPayload('health check failed'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
