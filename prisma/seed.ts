import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays } from "date-fns";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface FisekJsonItem {
  brand: string;
  model: string;
  product_name: string;
  caliber: string;
  gram: string;
  shot_number: string;
  case_price_try: number;
}

function slugifyCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/I/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

async function main() {
  console.log("🦌 Çavuş Av Bayii — Fişek Kategorisi ve 66 Av Fişeği Envanteri yükleniyor...");

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@depo.com.tr";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin123!";
  const adminName = "Çavuş Av Bayii (İşletme Sahibi / Yönetici)";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const empHash = await bcrypt.hash("Personel123!", 10);

  // Clean existing operational records to load the exact hunting & shells list cleanly
  await prisma.notification.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.supplier.deleteMany({});

  // 1. Settings
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {
      companyName: "Çavuş Av Bayii — Tüfek, Fişek ve Av Malzemeleri",
      currency: "TRY",
      currencySymbol: "₺",
      timezone: "Europe/Istanbul",
      lowStockAlertEnabled: true,
      customUnits: "Koli,Kutu,Adet,Paket,Takım,Şişe,Gram,Litre,Metre",
      defaultLocation: "MERKEZ-BAYI",
      valuationMethod: "STANDARD_COST",
    },
    create: {
      id: "default",
      companyName: "Çavuş Av Bayii — Tüfek, Fişek ve Av Malzemeleri",
      currency: "TRY",
      currencySymbol: "₺",
      timezone: "Europe/Istanbul",
      lowStockAlertEnabled: true,
      customUnits: "Koli,Kutu,Adet,Paket,Takım,Şişe,Gram,Litre,Metre",
      defaultLocation: "MERKEZ-BAYI",
      valuationMethod: "STANDARD_COST",
    },
  });

  // 2. Users
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: "ADMIN",
      isActive: true,
      canManageProducts: true,
      canManageCategories: true,
      canManageSuppliers: true,
      canStockIn: true,
      canStockOut: true,
      canAdjustStock: true,
      canViewReports: true,
      canExportData: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash: adminHash,
      role: "ADMIN",
      isActive: true,
      canManageProducts: true,
      canManageCategories: true,
      canManageSuppliers: true,
      canStockIn: true,
      canStockOut: true,
      canAdjustStock: true,
      canViewReports: true,
      canExportData: true,
    },
  });

  const storeSupervisor = await prisma.user.upsert({
    where: { email: "sorumlu@depo.com.tr" },
    update: {
      name: "Murat Çavuş (Mağaza & Ruhsat Sorumlusu)",
    },
    create: {
      email: "sorumlu@depo.com.tr",
      name: "Murat Çavuş (Mağaza & Ruhsat Sorumlusu)",
      passwordHash: empHash,
      role: "EMPLOYEE",
      isActive: true,
      canManageProducts: true,
      canManageCategories: true,
      canManageSuppliers: false,
      canStockIn: true,
      canStockOut: true,
      canAdjustStock: true,
      canViewReports: true,
      canExportData: true,
    },
  });

  const salesClerk = await prisma.user.upsert({
    where: { email: "personel@depo.com.tr" },
    update: {
      name: "Emre Kaya (Tezgâh & Depo Personeli)",
    },
    create: {
      email: "personel@depo.com.tr",
      name: "Emre Kaya (Tezgâh & Depo Personeli)",
      passwordHash: empHash,
      role: "EMPLOYEE",
      isActive: true,
      canManageProducts: false,
      canManageCategories: false,
      canManageSuppliers: false,
      canStockIn: true,
      canStockOut: true,
      canAdjustStock: false,
      canViewReports: false,
      canExportData: false,
    },
  });

  // 3. Categories — Dedicated "Fişek" Category first!
  const categoriesData = [
    {
      name: "Fişek",
      description:
        "Sterling, Mesco, Zuber, COM, CLK, Codex, Özkursan, Mega, Bugatti, YAF, RC, BP, Fiocchi, Bornaghi ve Mirage 12 Kalibre av fişekleri (Koli bazlı fiyat ve stok takibi)",
    },
    {
      name: "Av Tüfekleri",
      description: "12, 20 ve 36 Kalibre yarı otomatik, süperpoze ve şarjörlü yivsiz av tüfekleri",
    },
    {
      name: "Tabanca & Yivli Tüfek Mermileri",
      description: "9x19mm Parabellum ve .308 Win ruhsatlı istihkak mühimmatları",
    },
    {
      name: "Havalı Tüfek & Bakım Ekipmanları",
      description: "Havalı tüfekler, saçmalar (pellet), harbi takımları ve silah bakım yağları",
    },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.create({ data: cat });
    categoryMap[cat.name] = created.id;
  }

  // 4. Suppliers
  const sYerliFisek = await prisma.supplier.create({
    data: {
      companyName: "Yerli Av Fişekleri Ana Dağıtım A.Ş. (Sterling / Zuber / YAF / Mesco / Mega / Özkursan)",
      contactPerson: "Kadir Özdemir",
      phone: "0312 395 44 10",
      email: "siparis@yerlifisek.com.tr",
      address: "İvedik OSB Savunma Sanayi Sitesi 1420. Cad. No:18 Yenimahalle / Ankara",
      notes: "Yerli üretim 12 kalibre koli fişek sevkiyatları.",
    },
  });

  const sIthalFisek = await prisma.supplier.create({
    data: {
      companyName: "İthal Av Fişekleri Distribütörlüğü (RC / BP / Fiocchi / Bornaghi / Mirage / Bugatti)",
      contactPerson: "Serdar Soylu",
      phone: "0212 659 40 50",
      email: "ithalat@avfisekleri.com.tr",
      address: "İstoç Ticaret Merkezi 22. Ada No:14 Bağcılar / İstanbul",
      notes: "İtalyan ithal seri (RC Sipe, RC S4, Fiocchi, BP, Bornaghi, Mirage) koli fişek tedarikçisi.",
    },
  });

  const sTufek = await prisma.supplier.create({
    data: {
      companyName: "Konya Üzümlü & Beyşehir Silah Sanayi (Huğlu / Ata / Derya)",
      contactPerson: "Mustafa Çetin",
      phone: "0332 516 20 80",
      email: "sevkiyat@uzumlusilah.com.tr",
      address: "Huğlu ve Üzümlü Silah Sanayi Bölgesi Beyşehir / Konya",
      notes: "Yivsiz av tüfekleri üretici tedarikçisi.",
    },
  });

  // 5. Load all 66 items from av_fisekleri_depo.json into "Fişek" category
  const jsonFilePath = path.join(__dirname, "av_fisekleri_depo.json");
  const rawJson = fs.readFileSync(jsonFilePath, "utf-8");
  const fisekList: FisekJsonItem[] = JSON.parse(rawJson);

  const ithalBrands = new Set(["RC", "BP", "Fiocchi", "Bornaghi", "Mirage", "Bugatti"]);
  const createdFisekProducts = [];

  for (let i = 0; i < fisekList.length; i++) {
    const item = fisekList[i];
    const indexStr = String(i + 1).padStart(2, "0");
    const brandCode = slugifyCode(item.brand).slice(0, 3);
    const gramClean = item.gram.trim();
    const shotClean = item.shot_number.trim();
    const modelClean = item.model.trim();

    // Build clear, unambiguous Turkish display name
    const baseTitle =
      modelClean.toLowerCase() === "standart"
        ? `${item.brand} Standart`
        : item.product_name.trim();

    const shotSuffix = shotClean ? ` — No: ${shotClean}` : " — Tek Kurşun / Özel";
    const fullName = `${baseTitle} ${item.caliber} Kalibre ${gramClean}gr${shotSuffix}`;

    const sku = `FSK-${brandCode}-${gramClean.replace(/[^0-9]/g, "")}-${indexStr}`;
    const barcode = `869852000${String(1000 + i + 1)}`;

    // 1 Koli = 250 Adet Fişek (10 Kutu x 25 Adet)
    // Stok ve fiyat hesabı doğrudan tekil Fişek Sayısı (Adet) üzerinden tutulur
    let quantity = 1500;
    const minStockLevel = 250; // 250 adet (1 koli) altına düştüğünde Kritik Stok uyarısı
    if (i % 11 === 0) {
      quantity = 150; // Kritik Stok (LOW_STOCK)
    } else if (i === 14 || i === 47) {
      quantity = 0; // Stokta Yok (OUT_OF_STOCK)
    } else {
      quantity = 500 + ((i * 125) % 2500);
    }

    const singleShellCost = Number((item.case_price_try / 250).toFixed(2));
    const boxPrice = Number((item.case_price_try / 10).toFixed(2));
    const description = `Marka: ${item.brand} | Model: ${modelClean} | Kalibre: ${item.caliber} Cal | Gramaj: ${gramClean} gr | Saçma No: ${
      shotClean || "Slug / Tek Kurşun"
    } | Tek Fişek: ${singleShellCost.toLocaleString("tr-TR")} ₺ | 25'li Kutu: ${boxPrice.toLocaleString("tr-TR")} ₺ | 250'li Koli: ${item.case_price_try.toLocaleString("tr-TR")} ₺`;

    const supplierId = ithalBrands.has(item.brand)
      ? sIthalFisek.id
      : sYerliFisek.id;

    const imageUrl = `/api/product-image?kind=shell&brand=${encodeURIComponent(
      item.brand
    )}&model=${encodeURIComponent(modelClean)}&caliber=${encodeURIComponent(
      item.caliber
    )}&gram=${encodeURIComponent(gramClean)}&shot=${encodeURIComponent(
      shotClean
    )}`;

    const created = await prisma.product.create({
      data: {
        name: fullName,
        sku,
        barcode,
        description,
        imageUrl,
        quantity,
        unit: "Adet",
        minStockLevel,
        unitCost: singleShellCost,
        locationCode: `FISEK-RAF-${brandCode}`,
        categoryId: categoryMap["Fişek"],
        supplierId,
      },
    });
    createdFisekProducts.push(created);
  }

  // Also add sample Rifles so the hunting shop has its rifles alongside the 66 shells
  const sampleRifles = [
    {
      name: "Huğlu Renova 12 Kalibre Yarı Otomatik Av Tüfeği (71cm Namlu - Ceviz)",
      sku: "TFK-HGL-RNV12",
      barcode: "8697410001018",
      description: "12 Kalibre, 76mm Magnum yatak, 4+1 kapasite, 5 mobil şoklu Türk ceviz kundak yarı otomatik av tüfeği.",
      imageUrl: "/api/product-image?kind=rifle&brand=HUGLU&model=Renova%20Yar%C4%B1%20Otomatik&caliber=12",
      quantity: 5,
      unit: "Adet",
      minStockLevel: 2,
      unitCost: 14800.0,
      locationCode: "VITRIN-A1",
      categoryId: categoryMap["Av Tüfekleri"],
      supplierId: sTufek.id,
    },
    {
      name: "Ata Arms SP Black 12 Kalibre Süperpoze Av Tüfeği (66cm Namlu)",
      sku: "TFK-ATA-SP12",
      barcode: "8697410001025",
      description: "Çelik gövde, ejektörlü, tek tetik selektörlü 12 kalibre süperpoze av tüfeği.",
      imageUrl: "/api/product-image?kind=rifle&brand=ATA%20ARMS&model=SP%20Black%20S%C3%BCperpoze&caliber=12",
      quantity: 1,
      unit: "Adet",
      minStockLevel: 2,
      unitCost: 22500.0,
      locationCode: "VITRIN-A2",
      categoryId: categoryMap["Av Tüfekleri"],
      supplierId: sTufek.id,
    },
  ];

  for (const r of sampleRifles) {
    await prisma.product.create({ data: r });
  }

  // 6. Sample Stock Movements for the Fişek products across the last 7 days (by individual shell count - Adet)
  const now = new Date();
  if (createdFisekProducts.length >= 30) {
    const movs = [
      {
        movementCode: "GRS-20261020-300100",
        productId: createdFisekProducts[0].id, // Sterling Bıldırcın Özel
        type: "IN",
        quantity: 500,
        stockBefore: 250,
        stockAfter: 750,
        unitCost: 14.4,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "STR-IRS-2026-01",
        supplierId: sYerliFisek.id,
        userId: admin.id,
        movementDate: subDays(now, 6),
        createdAt: subDays(now, 6),
      },
      {
        movementCode: "CKS-20261020-300101",
        productId: createdFisekProducts[0].id,
        type: "OUT",
        quantity: 350,
        stockBefore: 750,
        stockAfter: 400,
        unitCost: 14.4,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-870",
        userId: salesClerk.id,
        movementDate: subDays(now, 6),
        createdAt: subDays(now, 6),
      },
      {
        movementCode: "GRS-20261021-300102",
        productId: createdFisekProducts[51].id, // RC Sipe 32gr
        type: "IN",
        quantity: 750,
        stockBefore: 250,
        stockAfter: 1000,
        unitCost: 36.0,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "ITH-RC-2026-41",
        supplierId: sIthalFisek.id,
        userId: admin.id,
        movementDate: subDays(now, 5),
        createdAt: subDays(now, 5),
      },
      {
        movementCode: "CKS-20261021-300103",
        productId: createdFisekProducts[51].id,
        type: "OUT",
        quantity: 450,
        stockBefore: 1000,
        stockAfter: 550,
        unitCost: 36.0,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-875",
        userId: storeSupervisor.id,
        movementDate: subDays(now, 5),
        createdAt: subDays(now, 5),
      },
      {
        movementCode: "GRS-20261022-300104",
        productId: createdFisekProducts[1].id, // Sterling Keklik Özel
        type: "IN",
        quantity: 625,
        stockBefore: 200,
        stockAfter: 825,
        unitCost: 15.4,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "STR-IRS-2026-08",
        supplierId: sYerliFisek.id,
        userId: admin.id,
        movementDate: subDays(now, 4),
        createdAt: subDays(now, 4),
      },
      {
        movementCode: "CKS-20261022-300105",
        productId: createdFisekProducts[1].id,
        type: "OUT",
        quantity: 425,
        stockBefore: 825,
        stockAfter: 400,
        unitCost: 15.4,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-881",
        userId: salesClerk.id,
        movementDate: subDays(now, 4),
        createdAt: subDays(now, 4),
      },
      {
        movementCode: "GRS-20261023-300106",
        productId: createdFisekProducts[21].id, // Zuber Bıldırcın Özel
        type: "IN",
        quantity: 625,
        stockBefore: 125,
        stockAfter: 750,
        unitCost: 15.2,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "ZBR-2026-112",
        supplierId: sYerliFisek.id,
        userId: storeSupervisor.id,
        movementDate: subDays(now, 3),
        createdAt: subDays(now, 3),
      },
      {
        movementCode: "CKS-20261023-300107",
        productId: createdFisekProducts[21].id,
        type: "OUT",
        quantity: 425,
        stockBefore: 750,
        stockAfter: 325,
        unitCost: 15.2,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-889",
        userId: salesClerk.id,
        movementDate: subDays(now, 3),
        createdAt: subDays(now, 3),
      },
      {
        movementCode: "GRS-20261024-300108",
        productId: createdFisekProducts[30].id, // BP 28gr Trap
        type: "IN",
        quantity: 400,
        stockBefore: 350,
        stockAfter: 750,
        unitCost: 19.0,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "ITH-BP-2026-19",
        supplierId: sIthalFisek.id,
        userId: admin.id,
        movementDate: subDays(now, 2),
        createdAt: subDays(now, 2),
      },
      {
        movementCode: "CKS-20261024-300109",
        productId: createdFisekProducts[30].id,
        type: "OUT",
        quantity: 275,
        stockBefore: 750,
        stockAfter: 475,
        unitCost: 19.0,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-895",
        userId: salesClerk.id,
        movementDate: subDays(now, 2),
        createdAt: subDays(now, 2),
      },
      {
        movementCode: "GRS-20261025-300110",
        productId: createdFisekProducts[10].id, // YAF 32gr
        type: "IN",
        quantity: 550,
        stockBefore: 200,
        stockAfter: 750,
        unitCost: 14.8,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "YAF-2026-55",
        supplierId: sYerliFisek.id,
        userId: storeSupervisor.id,
        movementDate: subDays(now, 1),
        createdAt: subDays(now, 1),
      },
      {
        movementCode: "CKS-20261025-300111",
        productId: createdFisekProducts[10].id,
        type: "OUT",
        quantity: 350,
        stockBefore: 750,
        stockAfter: 400,
        unitCost: 14.8,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-901",
        userId: salesClerk.id,
        movementDate: subDays(now, 1),
        createdAt: subDays(now, 1),
      },
      {
        movementCode: "GRS-20261026-300112",
        productId: createdFisekProducts[0].id,
        type: "IN",
        quantity: 625,
        stockBefore: 150,
        stockAfter: 775,
        unitCost: 14.4,
        reason: "Mal Kabul / Stok Girişi",
        referenceNo: "STR-IRS-2026-19",
        supplierId: sYerliFisek.id,
        userId: admin.id,
        movementDate: now,
        createdAt: now,
      },
      {
        movementCode: "CKS-20261026-300113",
        productId: createdFisekProducts[51].id,
        type: "OUT",
        quantity: 375,
        stockBefore: 875,
        stockAfter: 500,
        unitCost: 36.0,
        reason: "Satış (Ruhsatlı / Perakende)",
        referenceNo: "FIS-2026-908",
        userId: storeSupervisor.id,
        movementDate: now,
        createdAt: now,
      },
    ];

    for (const m of movs) {
      await prisma.stockMovement.create({ data: m });
    }

    // Notifications for low/out of stock Fişek items
    await prisma.notification.createMany({
      data: [
        {
          type: "OUT_OF_STOCK",
          severity: "CRITICAL",
          title: `Fişek Stoğu Tükendi: ${createdFisekProducts[14].name}`,
          message: `${createdFisekProducts[14].name} (${createdFisekProducts[14].sku}) ürününün stoğu tamamen tükendi (0 Adet).`,
          stateKey: `PRODUCT_STOCK_STATE:${createdFisekProducts[14].id}:OUT_OF_STOCK`,
          productId: createdFisekProducts[14].id,
          userId: admin.id,
        },
        {
          type: "LOW_STOCK",
          severity: "WARNING",
          title: `Kritik Fişek Stoğu: ${createdFisekProducts[0].name}`,
          message: `${createdFisekProducts[0].name} (${createdFisekProducts[0].sku}) kritik seviyede: 150 Adet kaldı (Alt Sınır: 250 Adet).`,
          stateKey: `PRODUCT_STOCK_STATE:${createdFisekProducts[0].id}:LOW_STOCK`,
          productId: createdFisekProducts[0].id,
          userId: admin.id,
        },
      ],
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "FISEK_JSON_IMPORT",
      entityType: "Category",
      entityId: categoryMap["Fişek"],
      userId: admin.id,
      summary: `av_fisekleri_depo.json dosyasındaki ${fisekList.length} adet av fişeği "Fişek" kategorisi altına aktarıldı.`,
    },
  });

  console.log(
    `✅ "Fişek" kategorisi oluşturuldu ve ${fisekList.length} adet fişek başarıyla listelendi!`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
