import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAPBOX_BASE = 'https://api.mapbox.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  if (!MAPBOX_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'MAPBOX_ACCESS_TOKEN not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      // ── Geocoding (Search) ──
      // Forward geocode: text → coordinates
      case 'geocode': {
        const { query, country = 'br', language = 'pt', limit = 5, types, proximity, bbox } = body;
        if (!query) {
          return new Response(JSON.stringify({ error: 'query is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          country,
          language,
          limit: String(limit),
        });
        if (types) params.set('types', types); // address,place,poi
        if (proximity) params.set('proximity', proximity); // lng,lat
        if (bbox) params.set('bbox', bbox);

        const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // Reverse geocode: coordinates → text
      case 'reverse-geocode': {
        const { lng, lat, types: rTypes, language: rLang = 'pt' } = body;
        if (lng == null || lat == null) {
          return new Response(JSON.stringify({ error: 'lng and lat are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          language: rLang,
        });
        if (rTypes) params.set('types', rTypes);

        const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // ── Directions ──
      // Get driving route between waypoints
      case 'directions': {
        const {
          coordinates, // array of [lng, lat] or "lng,lat;lng,lat" string
          profile = 'driving-traffic', // driving, driving-traffic, walking, cycling
          geometries = 'geojson',
          overview = 'full',
          steps = false,
          alternatives = false,
          language: dLang = 'pt',
          annotations,
        } = body;

        if (!coordinates) {
          return new Response(JSON.stringify({ error: 'coordinates are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Accept array of [lng,lat] or pre-formatted string
        const coordStr = Array.isArray(coordinates)
          ? coordinates.map((c: number[]) => c.join(',')).join(';')
          : coordinates;

        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          geometries,
          overview,
          steps: String(steps),
          alternatives: String(alternatives),
          language: dLang,
        });
        if (annotations) params.set('annotations', annotations);

        const url = `${MAPBOX_BASE}/directions/v5/mapbox/${profile}/${coordStr}?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // ── Matrix (Distance/Duration) ──
      case 'matrix': {
        const {
          coordinates: mCoords,
          profile: mProfile = 'driving',
          sources,
          destinations,
          annotations: mAnnotations = 'distance,duration',
        } = body;

        if (!mCoords) {
          return new Response(JSON.stringify({ error: 'coordinates are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const coordStr = Array.isArray(mCoords)
          ? mCoords.map((c: number[]) => c.join(',')).join(';')
          : mCoords;

        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          annotations: mAnnotations,
        });
        if (sources) params.set('sources', sources);
        if (destinations) params.set('destinations', destinations);

        const url = `${MAPBOX_BASE}/directions-matrix/v1/mapbox/${mProfile}/${coordStr}?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // ── Isochrone (Delivery zones) ──
      case 'isochrone': {
        const {
          lng: iLng, lat: iLat,
          profile: iProfile = 'driving',
          contours_minutes = '15,30,60',
          polygons = true,
        } = body;

        if (iLng == null || iLat == null) {
          return new Response(JSON.stringify({ error: 'lng and lat are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          contours_minutes,
          polygons: String(polygons),
        });

        const url = `${MAPBOX_BASE}/isochrone/v1/mapbox/${iProfile}/${iLng},${iLat}?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // ── Optimization (Multi-stop route optimization) ──
      case 'optimization': {
        const {
          coordinates: oCoords,
          profile: oProfile = 'driving',
          source: oSource = 'first',
          destination: oDest = 'last',
          roundtrip = false,
          steps: oSteps = false,
          geometries: oGeometries = 'geojson',
          overview: oOverview = 'full',
          language: oLang = 'pt',
          annotations: oAnnotations,
          distributions,
        } = body;

        if (!oCoords) {
          return new Response(JSON.stringify({ error: 'coordinates are required (array of [lng, lat], min 2, max 12)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const coordStr = Array.isArray(oCoords)
          ? oCoords.map((c: number[]) => c.join(',')).join(';')
          : oCoords;

        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          source: oSource,
          destination: oDest,
          roundtrip: String(roundtrip),
          steps: String(oSteps),
          geometries: oGeometries,
          overview: oOverview,
          language: oLang,
        });
        if (oAnnotations) params.set('annotations', oAnnotations);
        if (distributions) params.set('distributions', distributions);

        const url = `${MAPBOX_BASE}/optimized-trips/v1/mapbox/${oProfile}/${coordStr}?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // ── Map Matching (Snap GPS traces to roads) ──
      case 'map-matching': {
        const {
          coordinates: mmCoords,
          profile: mmProfile = 'driving',
          geometries: mmGeometries = 'geojson',
          overview: mmOverview = 'full',
          steps: mmSteps = false,
          timestamps,
          radiuses,
          annotations: mmAnnotations,
          tidy = true,
          language: mmLang = 'pt',
        } = body;

        if (!mmCoords) {
          return new Response(JSON.stringify({ error: 'coordinates are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const coordStr = Array.isArray(mmCoords)
          ? mmCoords.map((c: number[]) => c.join(',')).join(';')
          : mmCoords;

        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          geometries: mmGeometries,
          overview: mmOverview,
          steps: String(mmSteps),
          tidy: String(tidy),
          language: mmLang,
        });
        if (timestamps) params.set('timestamps', Array.isArray(timestamps) ? timestamps.join(';') : timestamps);
        if (radiuses) params.set('radiuses', Array.isArray(radiuses) ? radiuses.join(';') : radiuses);
        if (mmAnnotations) params.set('annotations', mmAnnotations);

        const url = `${MAPBOX_BASE}/matching/v5/mapbox/${mmProfile}/${coordStr}?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      // ── Static Images (Generate map images) ──
      case 'static-image': {
        const {
          style = 'dark-v11',
          lng: sLng, lat: sLat,
          zoom: sZoom = 12,
          bearing: sBearing = 0,
          pitch: sPitch = 0,
          width = 600,
          height: sHeight = 400,
          retina = true,
          markers: sMarkers,
          path: sPath,
          overlay,
        } = body;

        if (sLng == null || sLat == null) {
          return new Response(JSON.stringify({ error: 'lng and lat are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let overlayStr = '';
        if (sMarkers && Array.isArray(sMarkers)) {
          const markerParts = sMarkers.map((m: { lng: number; lat: number; color?: string; label?: string }) => {
            const color = m.color || 'f44336';
            const label = m.label || '';
            return `pin-s${label ? '-' + label : ''}+${color}(${m.lng},${m.lat})`;
          });
          overlayStr = markerParts.join(',') + '/';
        }
        if (sPath && Array.isArray(sPath)) {
          const pathCoords = sPath.map((c: number[]) => `${c[0]},${c[1]}`).join(',');
          overlayStr += `path-5+3b82f6-0.7(${encodeURIComponent(pathCoords)})/`;
        }
        if (overlay) {
          overlayStr = overlay + '/';
        }

        const retinaStr = retina ? '@2x' : '';
        const url = `${MAPBOX_BASE}/styles/v1/mapbox/${style}/static/${overlayStr}${sLng},${sLat},${sZoom},${sBearing},${sPitch}/${width}x${sHeight}${retinaStr}?access_token=${MAPBOX_TOKEN}`;

        const resp = await fetch(url);
        if (!resp.ok) {
          const errText = await resp.text();
          return new Response(JSON.stringify({ error: `Static image error: ${resp.status}`, details: errText }),
            { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Return as base64 data URL
        const imgBuffer = await resp.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
        result = {
          image: `data:image/png;base64,${base64}`,
          width,
          height: sHeight,
          url: url.replace(MAPBOX_TOKEN, '[REDACTED]'),
        };
        break;
      }

      // ── Tilequery (Query features at location) ──
      case 'tilequery': {
        const {
          lng: tLng, lat: tLat,
          tileset = 'mapbox.mapbox-streets-v8',
          radius: tRadius = 100,
          limit: tLimit = 5,
          layers: tLayers,
        } = body;

        if (tLng == null || tLat == null) {
          return new Response(JSON.stringify({ error: 'lng and lat are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          radius: String(tRadius),
          limit: String(tLimit),
        });
        if (tLayers) params.set('layers', tLayers);

        const url = `${MAPBOX_BASE}/v4/${tileset}/tilequery/${tLng},${tLat}.json?${params}`;
        const resp = await fetch(url);
        result = await resp.json();
        break;
      }

      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid action',
            availableActions: ['geocode', 'reverse-geocode', 'directions', 'matrix', 'isochrone', 'optimization', 'map-matching', 'static-image', 'tilequery'],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Mapbox proxy error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
