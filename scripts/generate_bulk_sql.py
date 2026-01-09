#!/usr/bin/env python3
"""
Generate bulk SQL for claims import (more efficient than individual INSERTs).
"""

import json

TENANT_ID = "00000000-0000-0000-0000-000000000001"
BATCH_SIZE = 100  # Insert 100 records per batch

def escape_sql(s):
    """Escape single quotes for SQL."""
    if s is None:
        return None
    return s.replace("'", "''")

def generate_bulk_sql():
    # Load claims data
    with open("scripts/claims_data.json", "r") as f:
        claims = json.load(f)

    print(f"Total claims: {len(claims)}")

    # Generate VALUES for bulk insert
    batches = []
    current_batch = []

    for i, claim in enumerate(claims):
        order_ref = escape_sql(claim['order_ref'])
        opened_at = claim['opened_at']
        description = escape_sql(claim['description']) if claim['description'] else None
        decision_note = escape_sql(claim['decision_note']) if claim['decision_note'] else None

        desc_sql = f"'{description}'" if description else 'NULL'
        note_sql = f"'{decision_note}'" if decision_note else 'NULL'

        value = f"('{TENANT_ID}', '{order_ref}', '{opened_at}'::date, 'cloturee'::claim_status, {desc_sql}, {note_sql})"
        current_batch.append(value)

        if len(current_batch) >= BATCH_SIZE:
            batches.append(current_batch)
            current_batch = []

    if current_batch:
        batches.append(current_batch)

    print(f"Generated {len(batches)} batches")

    # Write batch files
    for i, batch in enumerate(batches):
        sql = f"""-- Batch {i+1}/{len(batches)} ({len(batch)} records)
INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
VALUES
{',\n'.join(batch)}
ON CONFLICT (tenant_id, order_ref) WHERE order_ref IS NOT NULL DO NOTHING;
"""
        filename = f"scripts/claims_batch_{i+1:03d}.sql"
        with open(filename, "w") as f:
            f.write(sql)

    # Also generate a combined file with first batch for verification
    print(f"\nFirst batch sample saved to scripts/claims_batch_001.sql")
    print(f"Generated {len(batches)} batch files")

    return batches

if __name__ == "__main__":
    generate_bulk_sql()
