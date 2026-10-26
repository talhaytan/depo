# DEPO — Envanter ve Depo Yönetim Web Uygulaması

**DEPO**, küçük ve orta ölçekli işletmeler, mağazalar ve depolar için geliştirilmiş, çok kullanıcılı, işlem güvenliği (transaction-safe) odaklı, Türkçe arayüzlü bir envanter ve depo yönetim sistemidir.

---

## 1. Temel Özellikler

- **Rol ve Yetki Tabanlı Erişim (RBAC):**
  - **Sistem Yöneticisi (`ADMIN`):** Tüm modüllere erişim, personel hesabı oluşturma/düzenleme/pasife alma, modül bazlı yetki tanımlama, stok düzeltme, ters kayıt ve denetim günlüğü (`AuditLog`) görüntüleme.
  - **Depo Personeli (`EMPLOYEE`):** Yalnızca kendisine yetki verilen işlemleri (Stok Girişi, Stok Çıkışı, Ürün/Kategori/Tedarikçi yönetimi, Rapor görüntüleme, CSV dışa aktarma) gerçekleştirebilir. Tüm yetkiler sunucu tarafında (`requireUser`) zorunlu olarak denetlenir.
- **Genel Bakış (Dashboard):**
  - Veritabanından canlı hesaplanan 6 KPI özeti: Toplam ürün çeşidi, toplam stok miktarı, kritik stoktaki ürünler, stokta olmayan ürünler, günlük stok girişleri ve günlük stok çıkışları.
  - Son 7 günlük Stok Giriş / Çıkış karşılaştırma grafiği (`Recharts`).
  - Kritik ve tükenen stok tablosu (tek tıkla hızlı stok ekleme aksiyonu).
  - En çok hareket gören ürünler ve son 10 stok hareketi.
- **Ürün Yönetimi ve Ürün Detay Sayfası:**
  - Ürün adı, benzersiz Stok Kodu (`SKU`), isteğe bağlı benzersiz `Barkod`, kategori, tedarikçi, ölçü birimi (`Adet`, `Kutu`, `Paket`, `Kg`, `Gram`, `Litre`, `Metre`, vb.), kritik stok eşiği ve alış birim maliyeti (`₺`).
  - Geçmiş stok hareketi bulunan ürünler veri bütünlüğü için kalıcı olarak silinmez; güvenli biçimde **arşivlenir**.
- **İşlem Güvenlikli (Transactional) Stok Giriş, Çıkış, Sayım Düzeltme ve Ters Kayıt:**
  - Stok bakiyesi asla negatif (`< 0`) olamaz.
  - Stok bakiyesi güncellemesi, hareket kaydı (`StockMovement`), kritik stok bildirimi (`Notification`) ve denetim izi (`AuditLog`) aynı veritabanı işlemi (`prisma.$transaction`) içinde atomik olarak yürütülür.
  - Eşzamanlı (concurrent) stok çıkış talepleri seri kuyruk ve atomik koşullu güncelleme (`quantity: { gte: qty }`) ile korunur; fazla satış (overselling) engellenir.
  - İdempotensi anahtarı (`idempotencyKey`) ile mükerrer form gönderimleri önlenir.
  - Stok hareketleri değiştirilemez (`immutable`) kayıtlardır. Hatalı işlemler orijinal kayıt silinmeden **Ters Kayıt (`REVERSAL`)** veya **Stok Düzeltme (`ADJUSTMENT`)** ile düzeltilir.
- **Raporlar ve Açık Envanter Değerleme Metodolojisi:**
  - Mevcut envanter, kritik stok, tükenen stok, kategori bazlı envanter değeri, giriş/çıkış aktivitesi, ürün hareket geçmişi ve personel aktivite raporları.
  - **Envanter Değerleme Formülü:** $\text{Envanter Değeri} = \sum (\text{Mevcut Stok Miktarı} \times \text{Kayıtlı Birim Alış Maliyeti})$. Alış maliyeti perakende satış değeri veya kâr olarak sunulmaz.
  - Tüm tablolarda Türkçe karakter uyumlu (`UTF-8 BOM`) **CSV dışa aktarma** desteği.

---

## 2. Kurulum ve Çalıştırma Adımları

### Gereksinimler
- **Node.js** 18+ (önerilen 20+ veya 24+)
- **npm**

### Adım 1: Ortam Değişkenlerini Yapılandırın
Proje dizininde `.env.example` dosyasını `.env` olarak kopyalayın:

```bash
cp .env.example .env
```

- **Yerel Geliştirme / Sıfır Kurulum Modu:** Varsayılan olarak `DATABASE_URL="file:./dev.db"` (SQLite) tanımlıdır; harici bir veritabanı sunucusu kurmadan doğrudan çalışır.
- **Üretim (PostgreSQL) Modu:** Üretim ortamında PostgreSQL kullanmak için `prisma/schema.postgresql.prisma` şemasını `prisma/schema.prisma` üzerine kopyalayın ve `.env` dosyasında `DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/depo?schema=public"` bağlantısını tanımlayın.

### Adım 2: Bağımlılıkları ve Veritabanı Şemasını Hazırlayın

```bash
npm install
npm run db:generate
npm run db:push
```

### Adım 3: İlk Yönetici Hesabını ve Örnek Verileri Oluşturun (Provisioning)

Güvenlik kuralları gereği dışarıya açık bir yönetici kayıt (`/register`) sayfası bulunmamaktadır. İlk sistem yöneticisi `.env` içindeki `INITIAL_ADMIN_EMAIL` ve `INITIAL_ADMIN_PASSWORD` değişkenleri kullanılarak aşağıdaki komutla güvenli şekilde oluşturulur:

```bash
npm run db:seed
```

### Adım 4: Uygulamayı Başlatın

```bash
# Geliştirme sunucusu:
npm run dev

# Üretim derlemesi ve başlatma:
npm run build
npm run start
```

Tarayıcınızda `http://localhost:3000` adresini açın.

---

## 3. Hazır Test / Başlangıç Hesapları

`npm run db:seed` komutu çalıştırıldığında aşağıdaki bireysel hesaplar tanımlanır:

| Rol | E-Posta | Şifre | Yetki Kapsamı |
| :--- | :--- | :--- | :--- |
| **Sistem Yöneticisi** | `admin@depo.com.tr` | `Admin123!` | Tüm modüller, kullanıcı/yetki yönetimi, ayarlar, denetim günlüğü |
| **Depo Sorumlusu** | `sorumlu@depo.com.tr` | `Personel123!` | Ürün/kategori yönetimi, stok giriş/çıkış/düzeltme, raporlar, CSV |
| **Depo Personeli** | `personel@depo.com.tr` | `Personel123!` | Ürün görüntüleme/arama, yetkili stok girişi ve stok çıkışı |

---

## 4. Otomatik Testler

Kritik iş kurallarını (benzersiz SKU ve barkod, stok giriş/çıkış, negatif stok engelleme, eşzamanlı stok çıkış koruması, işlem geri alma, yetki denetimi, kritik stok hesaplama ve dashboard metrikleri) doğrulayan test paketini çalıştırmak için:

```bash
npm test
```
