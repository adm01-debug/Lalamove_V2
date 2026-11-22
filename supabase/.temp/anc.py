import io
p="supabase/functions/job-worker/index.ts"
s=io.open(p,encoding="utf-8").read()

old = """/**
 * `eta_refresh` — Matrix 1x1 `driving-traffic` motorista -> proxima parada."""

# use exact substring from file instead
idx = s.find("/**\n * `eta_refresh`")
assert idx > 0, "anchor nao encontrado"
anchor = s[idx:idx+220]
print(repr(anchor))