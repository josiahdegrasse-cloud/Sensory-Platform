import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  // Verify the caller is an authenticated admin
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the user's JWT and check admin role using anon client (respects RLS)
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('role')
    .single()

  if (profileError || profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { productId } = await req.json()

    const { data: responses, error } = await serviceClient
      .from('responses')
      .select('user_id, hedonic_scores, cata_attributes, intensity_ratings')
      .eq('product_id', productId)

    if (error) throw error

    const count = responses?.length ?? 0
    if (count === 0) {
      return new Response(JSON.stringify({ count: 0, hedonicMeans: {}, topCataAttributes: [] }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      })
    }

    const hedonicKeys = ['overall', 'appearance', 'aroma', 'flavor', 'texture']
    const hedonicMeans: Record<string, number> = {}
    for (const key of hedonicKeys) {
      const values = responses!
        .map(r => (r.hedonic_scores as Record<string, number>)?.[key])
        .filter((v): v is number => typeof v === 'number')
      hedonicMeans[key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    }

    const cataCounts: Record<string, number> = {}
    for (const r of responses!) {
      for (const attr of ((r.cata_attributes as string[]) ?? [])) {
        cataCounts[attr] = (cataCounts[attr] ?? 0) + 1
      }
    }
    const topCataAttributes = Object.entries(cataCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([attr, freq]) => ({ attr, freq, pct: Math.round((freq / count) * 100) }))

    return new Response(
      JSON.stringify({ count, hedonicMeans, topCataAttributes }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    })
  }
})
