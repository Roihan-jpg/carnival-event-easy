insert into public.events (
  id,
  name,
  year,
  event_date,
  route_description,
  timezone,
  status,
  normal_performance_minutes,
  finish_extra_minutes,
  aggregation_method,
  rounding_scale,
  attraction_mode,
  attraction_point_value,
  tie_break_config
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Karnaval Kecamatan Randuagung 2026',
  2026,
  '2026-08-22',
  'Pasar Desa Tunjung, barat Simpang Tiga Tunjung, sampai depan Kantor Kecamatan Randuagung',
  'Asia/Jakarta',
  'draft',
  10,
  4,
  'average',
  2,
  'fixed_points',
  2,
  '[
    "CONCEPT_ORIGINALITY",
    "VISUAL_ARTISTRY",
    "CULTURAL_VALUE",
    "DISCIPLINE_COHESION",
    "LOWEST_PENALTY",
    "JURY_COUNCIL_MINUTES"
  ]'::jsonb
);

insert into public.participant_categories (id, event_id, code, name, sort_order)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'EDUCATION',
    'Pendidikan',
    1
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'GENERAL',
    'Umum',
    2
  );

insert into public.judging_locations (
  id,
  event_id,
  code,
  name,
  address_note,
  sort_order
)
values
  (
    '00000000-0000-4000-8100-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'START',
    'Start',
    'Lokasi pelepasan peserta',
    1
  ),
  (
    '00000000-0000-4000-8100-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'GEDANGMAS_B_EDI',
    'Simpang Tiga B. Edi',
    'Gedangmas',
    2
  ),
  (
    '00000000-0000-4000-8100-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'FINISH',
    'Finish',
    'Depan Kantor Kecamatan Randuagung',
    3
  );

insert into public.score_criteria (
  id,
  event_id,
  code,
  name,
  description,
  max_score,
  sort_order
)
values
  (
    '00000000-0000-4000-8400-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'CONCEPT_ORIGINALITY',
    'Konsep dan Orisinalitas',
    'Kekuatan gagasan dan kebaruan konsep.',
    20,
    1
  ),
  (
    '00000000-0000-4000-8400-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'STORY_FLOW',
    'Alur Cerita',
    'Kejelasan dan kesinambungan alur.',
    15,
    2
  ),
  (
    '00000000-0000-4000-8400-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'VISUAL_ARTISTRY',
    'Artistik Visual',
    'Mutu artistik dan dampak visual.',
    20,
    3
  ),
  (
    '00000000-0000-4000-8400-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'CHOREOGRAPHY_PRESENTATION',
    'Koreografi dan Penyajian',
    'Kualitas koreografi dan penyajian atraksi.',
    15,
    4
  ),
  (
    '00000000-0000-4000-8400-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'CULTURAL_VALUE',
    'Nilai Budaya',
    'Kekuatan nilai dan representasi budaya.',
    10,
    5
  ),
  (
    '00000000-0000-4000-8400-000000000006',
    '00000000-0000-4000-8000-000000000001',
    'ENTERTAINMENT_VALUE',
    'Entertainment Value',
    'Daya tarik dan hiburan bagi penonton.',
    10,
    6
  ),
  (
    '00000000-0000-4000-8400-000000000007',
    '00000000-0000-4000-8000-000000000001',
    'MUSIC_SOUND',
    'Musik dan Tata Suara',
    'Kesesuaian musik dan kualitas tata suara.',
    5,
    7
  ),
  (
    '00000000-0000-4000-8400-000000000008',
    '00000000-0000-4000-8000-000000000001',
    'DISCIPLINE_COHESION',
    'Kedisiplinan dan Kekompakan',
    'Ketepatan, disiplin, dan kekompakan tim.',
    5,
    8
  );

insert into public.attraction_points (
  id,
  event_id,
  code,
  name,
  address_note,
  sort_order,
  point_value
)
values
  (
    '00000000-0000-4000-8200-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'JUNAIDI',
    'Simpang Tiga Junaidi',
    'Barat Balai Desa Gedangmas',
    1,
    2
  ),
  (
    '00000000-0000-4000-8200-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'B_SUL',
    'Simpang Tiga B. Sul',
    'Timur Masjid Jamik Gedangmas',
    2,
    2
  ),
  (
    '00000000-0000-4000-8200-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'TOKO_AMINAH',
    'Depan Toko Aminah',
    'Pasar Randuagung',
    3,
    2
  );

insert into public.penalty_types (
  id,
  event_id,
  code,
  name,
  default_deduction,
  requires_approval
)
values
  (
    '00000000-0000-4000-8300-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'LIGHT',
    'Pelanggaran Ringan',
    2,
    false
  ),
  (
    '00000000-0000-4000-8300-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'MEDIUM',
    'Pelanggaran Sedang',
    5,
    false
  ),
  (
    '00000000-0000-4000-8300-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'HEAVY',
    'Pelanggaran Berat',
    10,
    true
  );

insert into public.participants (
  id,
  event_id,
  category_id,
  sequence_number,
  name,
  theme,
  coordinator_name,
  coordinator_phone,
  member_count,
  scheduled_departure_at,
  estimated_finish_at,
  status
)
select
  format(
    '00000000-0000-4000-9000-%s',
    lpad(participant_number::text, 12, '0')
  )::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  case
    when participant_number <= 3
      then '00000000-0000-4000-8000-000000000101'::uuid
    else '00000000-0000-4000-8000-000000000102'::uuid
  end,
  participant_number,
  format('Peserta Demo %s', lpad(participant_number::text, 2, '0')),
  format('Tema Peserta %s', lpad(participant_number::text, 2, '0')),
  format('Koordinator %s', lpad(participant_number::text, 2, '0')),
  format('08%s', lpad(participant_number::text, 10, '0')),
  30,
  '2026-08-22 10:30:00+07'::timestamptz
    + interval '15 minutes' * (participant_number - 1),
  '2026-08-22 10:30:00+07'::timestamptz
    + interval '15 minutes' * (participant_number - 1)
    + interval '7 hours',
  'registered'::public.participant_status
from generate_series(1, 20) as participant_number;
