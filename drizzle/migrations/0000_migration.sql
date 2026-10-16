CREATE TYPE public.app_role AS ENUM ('admin','student');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  current_level int,
  test_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  goals text NOT NULL DEFAULT '',
  levels_label text NOT NULL DEFAULT 'Level 1–2',
  schedule text NOT NULL DEFAULT '',
  quota int NOT NULL DEFAULT 10,
  price int NOT NULL DEFAULT 0,
  price_prefix text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read classes" ON public.classes FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin write classes" ON public.classes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount int NOT NULL,
  method text NOT NULL DEFAULT 'Transfer bank',
  sender_name text,
  note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read enrollments" ON public.enrollments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "student create pending" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "admin update enrollments" ON public.enrollments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- security: students can only insert pending with correct amount
CREATE OR REPLACE FUNCTION public.enrollment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.status := 'pending'; NEW.paid_at := NULL;
    SELECT price INTO NEW.amount FROM public.classes WHERE id = NEW.class_id;
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enrollment_guard BEFORE INSERT OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.enrollment_guard();

CREATE OR REPLACE FUNCTION public.has_paid(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id=_user_id AND class_id=_class_id AND status='paid')
$$;

CREATE TABLE public.class_private (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  whatsapp_link text NOT NULL DEFAULT '',
  zoom_link text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_private TO authenticated;
GRANT ALL ON public.class_private TO service_role;
ALTER TABLE public.class_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paid read private" ON public.class_private FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_paid(auth.uid(), class_id));
CREATE POLICY "admin write private" ON public.class_private FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 1,
  number int NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  scheduled_at text NOT NULL DEFAULT '',
  UNIQUE(class_id, level, number)
);
GRANT SELECT ON public.class_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sessions" ON public.class_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write sessions" ON public.class_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.session_recordings (
  session_id uuid PRIMARY KEY REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_recordings TO authenticated;
GRANT ALL ON public.session_recordings TO service_role;
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paid read rec" ON public.session_recordings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_paid(auth.uid(), class_id));
CREATE POLICY "admin write rec" ON public.session_recordings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed
INSERT INTO public.classes (slug,name,tagline,description,goals,levels_label,schedule,quota,price,price_prefix,sort_order) VALUES
('kelas-besar','Kelas Besar','Belajar bersama, suasana ramai dan menyenangkan','Kelas online via Zoom untuk dewasa dan ibu-ibu yang ingin belajar membaca Al-Qur''an dari nol. Guru membimbing pelan-pelan, Anda boleh menyalakan kamera atau tidak.','Mengenal huruf hijaiyah, harakat, dan mampu membaca Al-Qur''an dengan lancar serta tajwid dasar.','Level 1–2','Sabtu & Ahad, 08.00–09.00 WIB',40,100000,'',1),
('kelas-kecil','Kelas Kecil','Maksimal 8 orang, lebih banyak giliran membaca','Kelompok kecil agar setiap murid mendapat giliran membaca dan koreksi langsung dari guru di setiap sesi.','Membaca Al-Qur''an dengan benar, lancar, dan percaya diri dengan koreksi personal.','Level 1–2','Selasa & Kamis, 19.30–20.30 WIB',8,250000,'',2),
('privat','Privat','Satu guru, satu murid, jadwal fleksibel','Belajar empat mata dengan guru pilihan. Cocok bagi yang ingin cepat, sangat sibuk, atau masih malu belajar bersama orang lain.','Target belajar disesuaikan kebutuhan Anda, dari mengenal huruf hingga tahsin.','Level 1–2','Jadwal fleksibel, disepakati bersama guru',5,300000,'Mulai',3);

INSERT INTO public.class_private (class_id, whatsapp_link, zoom_link)
SELECT id, 'https://chat.whatsapp.com/contoh-' || slug, 'https://zoom.us/j/0000000000' FROM public.classes;

INSERT INTO public.class_sessions (class_id, level, number, title, description)
SELECT c.id, 1, s.n, s.t, s.d FROM public.classes c CROSS JOIN (VALUES
(1,'Mengenal Huruf Hijaiyah (1)','Alif sampai Kha: bentuk dan cara melafalkan.'),
(2,'Mengenal Huruf Hijaiyah (2)','Dal sampai Dhad: bentuk dan cara melafalkan.'),
(3,'Mengenal Huruf Hijaiyah (3)','Tha sampai Ya: menuntaskan 28 huruf.'),
(4,'Harakat Fathah','Membaca huruf berharakat a (fathah).'),
(5,'Harakat Kasrah','Membaca huruf berharakat i (kasrah).'),
(6,'Harakat Dhammah','Membaca huruf berharakat u (dhammah).'),
(7,'Latihan Gabungan Harakat','Membaca rangkaian huruf dengan tiga harakat.'),
(8,'Huruf Bersambung','Mengenal bentuk huruf di awal, tengah, dan akhir kata.'),
(9,'Tanwin','Bunyi an, in, un dan cara membacanya.'),
(10,'Sukun','Huruf mati dan cara menyambungnya.'),
(11,'Tasydid','Huruf bertasydid dan latihan membaca.'),
(12,'Mad Thabi''i','Bacaan panjang dua harakat.'),
(13,'Latihan Kata Pendek','Membaca kata-kata pendek dari Al-Qur''an.'),
(14,'Latihan Kalimat','Membaca kalimat pendek dengan lancar.'),
(15,'Membaca Surah Pendek','Latihan Al-Fatihah dan An-Nas.'),
(16,'Evaluasi Level 1','Tes membaca dan umpan balik dari guru.')
) AS s(n,t,d);

INSERT INTO public.class_sessions (class_id, level, number, title, description)
SELECT c.id, 2, s.n, s.t, s.d FROM public.classes c CROSS JOIN (VALUES
(1,'Makharijul Huruf (1)','Tempat keluar huruf dari tenggorokan.'),
(2,'Makharijul Huruf (2)','Tempat keluar huruf dari lidah dan bibir.'),
(3,'Sifat Huruf','Huruf tebal dan tipis.'),
(4,'Nun Mati: Izhar','Membaca nun mati/tanwin dengan jelas.'),
(5,'Nun Mati: Idgham','Memasukkan bunyi nun mati ke huruf berikutnya.'),
(6,'Nun Mati: Iqlab','Mengubah bunyi nun mati menjadi mim.'),
(7,'Nun Mati: Ikhfa','Menyamarkan bunyi nun mati.'),
(8,'Mim Mati','Ikhfa syafawi, idgham mimi, izhar syafawi.'),
(9,'Qalqalah','Bunyi memantul pada huruf qalqalah.'),
(10,'Mad Wajib & Jaiz','Bacaan panjang karena hamzah.'),
(11,'Mad Lazim & Aridh','Bacaan panjang karena sukun.'),
(12,'Lam Jalalah & Ra','Kapan dibaca tebal atau tipis.'),
(13,'Waqaf','Tanda berhenti dan cara berhenti yang benar.'),
(14,'Tilawah Juz Amma (1)','Latihan surah An-Naba sampai Abasa.'),
(15,'Tilawah Juz Amma (2)','Latihan surah-surah pendek pilihan.'),
(16,'Evaluasi Level 2','Tes tilawah dan rencana belajar lanjutan.')
) AS s(n,t,d);