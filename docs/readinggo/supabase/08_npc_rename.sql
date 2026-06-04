-- 08_npc_rename.sql
-- NPC 30계정 닉네임을 귀여운 한글 "형용사/명사 + 동물"로 (사용자 요청: 밋밋한 영문 → 귀엽고 재밌게)
-- 닉네임 규칙 준수: ^[A-Za-z0-9_가-힣]{2,20}$, handle UNIQUE. display_name = handle 동기화(Model A)
-- 적용: node docs/readinggo/supabase/admin-cli.mjs sql 08_npc_rename.sql

update public.users set handle='졸린토끼',        display_name='졸린토끼'        where handle='quiet_rabbit';
update public.users set handle='부지런한다람쥐',   display_name='부지런한다람쥐'   where handle='page_turner';
update public.users set handle='밤샘올빼미',       display_name='밤샘올빼미'       where handle='midnight_reader';
update public.users set handle='책읽는참새',       display_name='책읽는참새'       where handle='book_sparrow';
update public.users set handle='느긋한판다',       display_name='느긋한판다'       where handle='ink_and_tea';
update public.users set handle='느림보거북',       display_name='느림보거북'       where handle='slow_pages';
update public.users set handle='끄적이는수달',     display_name='끄적이는수달'     where handle='margin_notes';
update public.users set handle='비오는날고래',     display_name='비오는날고래'     where handle='rainy_chapter';
update public.users set handle='등불반딧불이',     display_name='등불반딧불이'     where handle='lamp_light';
update public.users set handle='한문장햄스터',     display_name='한문장햄스터'     where handle='one_sentence';
update public.users set handle='종이배펭귄',       display_name='종이배펭귄'       where handle='paper_boat';
update public.users set handle='먼지쌓인두더지',   display_name='먼지쌓인두더지'   where handle='dusty_shelf';
update public.users set handle='아침형종달새',     display_name='아침형종달새'     where handle='morning_lines';
update public.users set handle='새벽감성너구리',   display_name='새벽감성너구리'   where handle='late_night_owl';
update public.users set handle='조용한고슴도치',   display_name='조용한고슴도치'   where handle='quiet_margin';
update public.users set handle='초록책갈피개구리', display_name='초록책갈피개구리' where handle='green_bookmark';
update public.users set handle='단풍읽는사슴',     display_name='단풍읽는사슴'     where handle='autumn_reader';
update public.users set handle='말랑한물범',       display_name='말랑한물범'       where handle='soft_spine';
update public.users set handle='떠도는낙타',       display_name='떠도는낙타'       where handle='wandering_word';
update public.users set handle='차마시는코알라',   display_name='차마시는코알라'   where handle='tea_break';
update public.users set handle='별보는해마',       display_name='별보는해마'       where handle='starry_page';
update public.users set handle='고서점고양이',     display_name='고서점고양이'     where handle='old_library';
update public.users set handle='첫문장병아리',     display_name='첫문장병아리'     where handle='first_line';
update public.users set handle='마지막장표범',     display_name='마지막장표범'     where handle='last_line';
update public.users set handle='행간의나비',       display_name='행간의나비'       where handle='between_lines';
update public.users set handle='속삭이는담비',     display_name='속삭이는담비'     where handle='whisper_read';
update public.users set handle='깊이읽는돌고래',   display_name='깊이읽는돌고래'   where handle='deep_dive';
update public.users set handle='다정한곰',         display_name='다정한곰'         where handle='gentle_reader';
update public.users set handle='눈오는날북극곰',   display_name='눈오는날북극곰'   where handle='snowy_chapter';
update public.users set handle='활짝편책벌레',     display_name='활짝편책벌레'     where handle='open_book';
