"""Disposable synthetic DB only: PGHOST/PGPORT/PGUSER required. Two real psql connections."""
import os
import subprocess
import time
import uuid

assert os.environ.get('PGHOST', '').startswith('/tmp/'), 'disposable local socket required'
assert os.environ.get('PGPORT'), 'explicit disposable port required'
processes = []
PSQL = os.environ.get('PSQL', 'psql')
CMD = [PSQL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres']

def run(sql):
    p = subprocess.run(CMD, input=sql, text=True, capture_output=True)
    if p.returncode:
        raise AssertionError(p.stderr)
    return p.stdout.strip()

owner, book = str(uuid.uuid4()), str(uuid.uuid4())
run(f"""
insert into auth.users(id) values('{owner}');
insert into public.users(id,handle,display_name,settings)
values('{owner}','race_{owner[:8]}','Synthetic race','{{"ugc_terms":{{"version":"2026-08-01","accepted_at":"2026-09-03T00:00:00Z"}}}}')
on conflict(id) do update set settings=excluded.settings;
insert into public.books(id,title,author) values('{book}','Synthetic concurrency','Fixture');
""")
try:
    for first_import in (True, False):
        ub, sentence, request = [str(uuid.uuid4()) for _ in range(3)]
        run(f"insert into public.user_books(id,user_id,book_id) values('{ub}','{owner}','{book}');")
        auth = f"set role authenticated; set request.jwt.claim.sub='{owner}';"
        imp = f"select public.sentence_import_private('{ub}','{sentence}','Race quote');"
        vis = f"select public.book_set_visibility('{ub}','public',0,'{request}');"
        a = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        processes.append(a)
        assert a.stdin and a.stdout and a.stderr
        a.stdin.write('begin;'+auth+(imp if first_import else vis)+'\n\\echo READY\n')
        a.stdin.flush()
        while a.stdout.readline().strip() != 'READY':
            if a.poll() is not None:
                raise AssertionError(a.stderr.read())
        b = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        processes.append(b)
        assert b.stdin and b.stdout and b.stderr
        b.stdin.write("set application_name='readinggo_privacy_race';"+auth+(vis if first_import else imp)+'\n')
        b.stdin.close()
        # Observe the actual lock wait, rather than assuming a scheduling delay proves concurrency.
        deadline = time.monotonic()+5
        while True:
            a.stdin.write("reset role; select pg_stat_clear_snapshot(); select count(*) from pg_stat_activity where application_name='readinggo_privacy_race' and wait_event_type='Lock';\n")
            a.stdin.flush()
            a.stdout.readline()  # void pg_stat_clear_snapshot result
            a.stdin.flush()
            if a.stdout.readline().strip() == '1':
                break
            assert time.monotonic() < deadline, 'second connection never waited on parent lock'
            time.sleep(.02)
        a.stdin.write('commit;\n\\q\n'); a.stdin.flush()
        assert a.wait(timeout=5) == 0, a.stderr.read()
        rc = b.wait(timeout=5)
        out, err = b.stdout.read(), b.stderr.read()
        if first_import:
            assert rc == 0, err
            assert run(f"select count(*) from public.sentences where id='{sentence}';") == '1'
            print('PASS import-first: publication waited, import preserved, then published')
        else:
            assert rc != 0 and 'import_requires_private_book' in err, (out, err)
            assert run(f"select count(*) from public.sentences where id='{sentence}';") == '0'
            print('PASS visibility-first: import waited, rejected after publication, no row inserted')
        assert run(f"select visibility from public.user_books where id='{ub}';") == 'public'
        run(f"delete from public.book_visibility_requests where user_book_id='{ub}'; delete from public.user_books where id='{ub}';")
finally:
    for process in processes:
        if process.poll() is None:
            process.kill()
            process.wait()
    run(f"delete from public.book_visibility_requests where user_book_id in (select id from public.user_books where user_id='{owner}'); delete from public.users where id='{owner}'; delete from auth.users where id='{owner}'; delete from public.books where id='{book}';")
