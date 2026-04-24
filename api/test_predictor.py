import sys
sys.path.append('.')
from app.predictor import ThalassemiaPredictor

p = ThalassemiaPredictor()

# Classic carrier
r1 = p.predict(age=25, mcv=62.0, mch=19.5, hbg=10.8)
assert r1['prediction'] == 1, f"Expected Carrier, got {r1['label']}"
assert r1['carrier_probability'] > 0.49, "Carrier probability too low"

# Clear non-carrier
r2 = p.predict(age=30, mcv=80.0, mch=27.0, hbg=13.0)
assert r2['prediction'] == 0, f"Expected Non-carrier, got {r2['label']}"

# With RBC — supplementary only
r3 = p.predict(age=25, mcv=62.0, mch=19.5, hbg=10.8, rbc=5.2)
assert r3['supplementary_indices'] is not None
assert r3['supplementary_indices']['mentzer'] < 13

print("All assertions passed — API pipeline is correct")
print(f"Carrier prob:     {r1['carrier_probability']}")
print(f"Non-carrier prob: {r2['carrier_probability']}")
print(f"Mentzer index:    {r3['supplementary_indices']['mentzer']}")
