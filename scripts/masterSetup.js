import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Employee from '../src/models/Auth/Employee.js';
import Department from '../src/models/Auth/Department.js';
import SystemConfig from '../src/models/Auth/SystemConfig.js';
import { generateEmployeeCode } from '../src/Utils/Auth/customerAuthUtils.js';
import PlatformOwner from '../src/models/Tenant/PlatformOwner.model.js';

import Location from '../src/models/Location/Location.js';

import State from '../src/models/Product/State.js';
import GSTType from '../src/models/Product/GSTType.js';
import BusinessType from '../src/models/Product/BusinessType.js';
import Country from '../src/models/Product/Country.js';
import BillingCurrency from '../src/models/Product/BillingCurrency.js';
import CreditDay from '../src/models/Product/CreditDay.js';
import CourierName from '../src/models/Product/CourierName.js';
import CourierTime from '../src/models/Product/CourierTime.js';
import Plant from '../src/models/Product/Plant.js';
import Lab from '../src/models/Product/Lab.js';
import SpecificLab from '../src/models/Product/SpecificLab.js';
import FittingCenter from '../src/models/Product/FittingCenter.js';

import Brand from '../src/models/Product/Brand.js';
import Category from '../src/models/Product/Category.js';

import ProductBrand from '../src/models/order/ProductBrand.js';
import ProductCategory from '../src/models/order/ProductCategory.js';
import ProductCoating from '../src/models/order/ProductCoating.js';
import ProductIndex from '../src/models/order/ProductIndex.js';
import ProductTreatment from '../src/models/order/ProductTreatment.js';
import ProductType from '../src/models/order/ProductType.js';
import FrameType from '../src/models/order/FrameType.js';
import Tint from '../src/models/order/Tint.js';

import Account from '../src/models/Accounting/Account.model.js';
import BankAccount from '../src/models/Accounting/BankAccount.model.js';

import Vendor from '../src/models/Vendor.model.js';
import Settings from '../src/models/SETTING/Settings.js';

dotenv.config({ quiet: true });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI;

// ==============================================================================
// 1. DATA DEFINITIONS & SCHEMA CONSTRAINTS
// ==============================================================================

const systemConfigData = {
  EmployeeType: ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'TEAMLEAD', 'EMPLOYEE'],
  Lab: [
    'KOLKATA STOCK', 'STOCK ORDER', 'VISUAL EYES LAB', 'VE AHMEDABAD LAB',
    'VE CHENNAI LAB', 'VE KOCHI LAB', 'VE GURGAON LAB', 'VE MUMBAI LAB',
    'VE TRIVANDRUM LAB', 'SERVICE', 'VE GLASS ORDER', 'VE PUNE LAB',
    'VE NAGPUR LAB', 'VE BENGALURU LAB', 'VE HYDERBAD LAB', 'VE KOLKATTA LAB'
  ],
  Region: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL']
};

const businessTypes = [
  'Distribution Partners',
  'Retailer',
  'Hospital Chain & Institutions',
  'Regional Key Account',
  'National Key Account',
  'Exports',
  'OEM',
  'Private Label',
  'Ophthalmologist / Eye Clinic'
];

const gstTypes = [
  'Regular',
  'Composition',
  'Unregistered',
  'Consumer',
  'Registered',
  'Un-Registered'
];

const indianStates = [
  'Jammu & Kashmir', 'Himachal Pradesh', 'Punjab', 'Chandigarh', 'Uttarakhand',
  'Haryana', 'Delhi', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Sikkim',
  'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 'Meghalaya',
  'Assam', 'West Bengal', 'Jharkhand', 'Odisha', 'Chhattisgarh', 'Madhya Pradesh',
  'Gujarat', 'Daman & Diu', 'Dadra & Nagar Haveli', 'Maharashtra', 'Karnataka',
  'Goa', 'Lakshadweep', 'Kerala', 'Tamil Nadu', 'Puducherry',
  'Andaman & Nicobar Islands', 'Telangana', 'Andhra Pradesh', 'Ladakh', 'Others'
];

const countries = ['India', 'Other'];
const billingCurrencies = ['Indian Rupees', 'USD'];
const creditDays = [0, 30, 45, 60, 90, 120, 150];

const courierNames = [
  'Jagdish', 'SJ courier', 'Verma Courier', 'Bluedart', 'Shyam',
  'Shree Raj Courier', 'Tanveer', 'Naveen', 'Rahul Rao', 'Chanchal',
  'Kamal', 'Hari Ram', 'Deepak', 'Anjani Courier', 'Trackon Courier', 'Office'
];

const courierTimes = [
  { location: 'Delhi/NCR', time: '14:00PM' },
  { location: 'Delhi/NCR', time: '6:00PM' },
  { location: 'Delhi/NCR', time: '8:00PM' },
  { location: 'Delhi/NCR', time: '3:00AM' },
  { location: 'Delhi/NCR2', time: '3:00AM' },
  { location: 'Delhi/NCR2', time: '4:00PM' },
  { location: 'Delhi/NCR2', time: '6:00PM' },
  { location: 'Delhi/NCR2', time: '8:00PM' }
];

const plants = [
  'VisualEyes Optik Technologies',
  'VisualEyes Rx Labs LLP'
];

const basicLabs = ['100', '101'];

const fittingCenters = [
  'VisualEyes-Optik Technologies',
  'VisualEyes Rx Labs LLP'
];

const specificLabs = [
  'KOLKATA STOCK', 'STOCK ORDER', 'VISUAL EYES LAB', 'VE AHMEDABAD LAB',
  'VE CHENNAI LAB', 'VE KOCHI LAB', 'VE GURGAON LAB', 'VE HYDERBAD LAB',
  'VE KOLKATTA LAB', 'VE MUMBAI LAB', 'VE TRIVANDRUM LAB', 'SERVICE',
  'VE GLASS ORDER', 'VE PUNE LAB', 'VE NAGPUR LAB', 'VE BENGALURU LAB'
];

const locationData = [
  {
    zone: 'NORTH',
    description: 'North Zone covering northern states including Delhi, Haryana, Punjab, Uttar Pradesh, Uttarakhand, Himachal Pradesh, and Jammu & Kashmir',
    states: [
      {
        name: 'Delhi',
        code: 'DEL',
        cities: [
          {
            name: 'New Delhi',
            code: 'NDEL',
            zipCodes: [
              { code: '110001', area: 'Connaught Place' },
              { code: '110002', area: 'Indraprastha Estate' },
              { code: '110003', area: 'Kamla Market' }
            ]
          },
          {
            name: 'North Delhi',
            code: 'NODEL',
            zipCodes: [
              { code: '110006', area: 'Kashmere Gate' },
              { code: '110007', area: 'Sadar Bazar' }
            ]
          }
        ]
      },
      {
        name: 'Haryana',
        code: 'HAR',
        cities: [
          {
            name: 'Gurgaon',
            code: 'GGN',
            zipCodes: [
              { code: '122001', area: 'Sector 1-15' },
              { code: '122002', area: 'Sector 16-30' },
              { code: '122003', area: 'DLF Phase 1-3' }
            ]
          },
          {
            name: 'Faridabad',
            code: 'FBD',
            zipCodes: [
              { code: '121001', area: 'Old Faridabad' },
              { code: '121002', area: 'New Industrial Town' }
            ]
          }
        ]
      },
      {
        name: 'Uttar Pradesh',
        code: 'UP',
        cities: [
          {
            name: 'Noida',
            code: 'NOI',
            zipCodes: [
              { code: '201301', area: 'Sector 1-50' },
              { code: '201302', area: 'Sector 51-100' },
              { code: '201310', area: 'Greater Noida' }
            ]
          },
          {
            name: 'Lucknow',
            code: 'LKO',
            zipCodes: [
              { code: '226001', area: 'Hazratganj' },
              { code: '226002', area: 'Gomti Nagar' },
              { code: '226003', area: 'Alambagh' }
            ]
          }
        ]
      }
    ]
  },
  {
    zone: 'SOUTH',
    description: 'South Zone covering southern states including Karnataka, Tamil Nadu, Kerala, Andhra Pradesh, and Telangana',
    states: [
      {
        name: 'Karnataka',
        code: 'KAR',
        cities: [
          {
            name: 'Bangalore',
            code: 'BLR',
            zipCodes: [
              { code: '560001', area: 'Bangalore City' },
              { code: '560002', area: 'Shivaji Nagar' },
              { code: '560066', area: 'Whitefield' },
              { code: '560100', area: 'Electronic City' }
            ]
          },
          {
            name: 'Mysore',
            code: 'MYS',
            zipCodes: [
              { code: '570001', area: 'Mysore City' },
              { code: '570002', area: 'Chamundi Hills' }
            ]
          }
        ]
      },
      {
        name: 'Tamil Nadu',
        code: 'TN',
        cities: [
          {
            name: 'Chennai',
            code: 'CHN',
            zipCodes: [
              { code: '600001', area: 'Parrys' },
              { code: '600002', area: 'Anna Salai' },
              { code: '600096', area: 'OMR' }
            ]
          },
          {
            name: 'Coimbatore',
            code: 'CBE',
            zipCodes: [
              { code: '641001', area: 'Coimbatore City' },
              { code: '641002', area: 'RS Puram' }
            ]
          }
        ]
      },
      {
        name: 'Kerala',
        code: 'KER',
        cities: [
          {
            name: 'Kochi',
            code: 'COK',
            zipCodes: [
              { code: '682001', area: 'Fort Kochi' },
              { code: '682002', area: 'Ernakulam' },
              { code: '682030', area: 'Kakkanad' }
            ]
          },
          {
            name: 'Thiruvananthapuram',
            code: 'TVM',
            zipCodes: [
              { code: '695001', area: 'Trivandrum City' },
              { code: '695002', area: 'Statue' }
            ]
          }
        ]
      },
      {
        name: 'Telangana',
        code: 'TEL',
        cities: [
          {
            name: 'Hyderabad',
            code: 'HYD',
            zipCodes: [
              { code: '500001', area: 'Abids' },
              { code: '500081', area: 'Hitech City' },
              { code: '500032', area: 'Gachibowli' }
            ]
          }
        ]
      }
    ]
  },
  {
    zone: 'EAST',
    description: 'East Zone covering eastern states including West Bengal, Odisha, Bihar, and Jharkhand',
    states: [
      {
        name: 'West Bengal',
        code: 'WB',
        cities: [
          {
            name: 'Kolkata',
            code: 'KOL',
            zipCodes: [
              { code: '700001', area: 'BBD Bagh' },
              { code: '700002', area: 'Howrah' },
              { code: '700091', area: 'Salt Lake' }
            ]
          },
          {
            name: 'Siliguri',
            code: 'SLG',
            zipCodes: [
              { code: '734001', area: 'Siliguri City' },
              { code: '734002', area: 'Matigara' }
            ]
          }
        ]
      },
      {
        name: 'Odisha',
        code: 'ORI',
        cities: [
          {
            name: 'Bhubaneswar',
            code: 'BBS',
            zipCodes: [
              { code: '751001', area: 'Bhubaneswar City' },
              { code: '751002', area: 'Kharavel Nagar' }
            ]
          }
        ]
      }
    ]
  },
  {
    zone: 'WEST',
    description: 'West Zone covering western states including Maharashtra, Gujarat, Rajasthan, and Goa',
    states: [
      {
        name: 'Maharashtra',
        code: 'MAH',
        cities: [
          {
            name: 'Mumbai',
            code: 'MUM',
            zipCodes: [
              { code: '400001', area: 'Fort' },
              { code: '400002', area: 'Kalbadevi' },
              { code: '400051', area: 'Bandra' },
              { code: '400093', area: 'Navi Mumbai' }
            ]
          },
          {
            name: 'Pune',
            code: 'PUN',
            zipCodes: [
              { code: '411001', area: 'Pune City' },
              { code: '411002', area: 'Shivaji Nagar' },
              { code: '411057', area: 'Hinjewadi' }
            ]
          }
        ]
      },
      {
        name: 'Gujarat',
        code: 'GUJ',
        cities: [
          {
            name: 'Ahmedabad',
            code: 'AMD',
            zipCodes: [
              { code: '380001', area: 'Ahmedabad City' },
              { code: '380002', area: 'Ellisbridge' },
              { code: '380015', area: 'Satellite' }
            ]
          },
          {
            name: 'Surat',
            code: 'SRT',
            zipCodes: [
              { code: '395001', area: 'Surat City' },
              { code: '395002', area: 'Athwa' }
            ]
          }
        ]
      },
      {
        name: 'Rajasthan',
        code: 'RAJ',
        cities: [
          {
            name: 'Jaipur',
            code: 'JPR',
            zipCodes: [
              { code: '302001', area: 'Pink City' },
              { code: '302002', area: 'Malviya Nagar' },
              { code: '302017', area: 'Vaishali Nagar' }
            ]
          }
        ]
      }
    ]
  },
  {
    zone: 'CENTRAL',
    description: 'Central Zone covering central states including Madhya Pradesh and Chhattisgarh',
    states: [
      {
        name: 'Madhya Pradesh',
        code: 'MP',
        cities: [
          {
            name: 'Bhopal',
            code: 'BPL',
            zipCodes: [
              { code: '462001', area: 'Bhopal City' },
              { code: '462002', area: 'MP Nagar' }
            ]
          },
          {
            name: 'Indore',
            code: 'IDR',
            zipCodes: [
              { code: '452001', area: 'Indore City' },
              { code: '452002', area: 'Vijay Nagar' }
            ]
          }
        ]
      },
      {
        name: 'Chhattisgarh',
        code: 'CHH',
        cities: [
          {
            name: 'Raipur',
            code: 'RPR',
            zipCodes: [
              { code: '492001', area: 'Raipur City' },
              { code: '492002', area: 'Civil Lines' }
            ]
          }
        ]
      }
    ]
  },
  {
    zone: 'NORTHEAST',
    description: 'Northeast Zone covering northeastern states including Assam, Arunachal Pradesh, Nagaland, Manipur, Mizoram, Tripura, Meghalaya, and Sikkim',
    states: [
      {
        name: 'Arunachal Pradesh',
        code: 'AP',
        cities: [
          {
            name: 'Itanagar',
            code: 'ITA',
            zipCodes: [
              { code: '791001', area: 'Itanagar City' },
              { code: '791002', area: 'Naharlagun' },
              { code: '791003', area: 'Nirjuli' }
            ]
          },
          {
            name: 'Tawang',
            code: 'TWG',
            zipCodes: [
              { code: '790104', area: 'Tawang Town' }
            ]
          }
        ]
      },
      {
        name: 'Assam',
        code: 'ASM',
        cities: [
          {
            name: 'Guwahati',
            code: 'GWH',
            zipCodes: [
              { code: '781001', area: 'Guwahati City' },
              { code: '781002', area: 'Panbazar' },
              { code: '781006', area: 'Paltan Bazar' }
            ]
          }
        ]
      }
    ]
  }
];

const departmentsData = [
  {
    name: 'FINANCE',
    code: 'FINANCE',
    description: 'Handles accounting, finance, and credit management',
    subRoles: [
      { name: 'New Account Creation', code: 'NEW_ACC', description: 'Create and manage new customer accounts', isActive: true },
      { name: 'Credit Note', code: 'CREDIT_NOTE', description: 'Manage credit notes and adjustments', isActive: true },
      { name: 'Receipts', code: 'RECEIPTS', description: 'Handle payment receipts and processing', isActive: true }
    ]
  },
  {
    name: 'LAB',
    code: 'LAB',
    description: 'Laboratory operations and quality control',
    subRoles: [
      { name: 'Surfacing', code: 'SURFACING', description: 'Lens surfacing operations', isActive: true },
      { name: 'Q1', code: 'Q1', description: 'Quality check stage 1', isActive: true },
      { name: 'Tint', code: 'TINT', description: 'Lens tinting operations', isActive: true },
      { name: 'Hardcoat', code: 'HARDCOAT', description: 'Hardcoat application', isActive: true },
      { name: 'HMC', code: 'HMC', description: 'Hard Multi Coating operations', isActive: true },
      { name: 'FQC + Fitting QC', code: 'FQC_FITTING', description: 'Final quality control and fitting quality check', isActive: true },
      { name: 'Fitting', code: 'FITTING', description: 'Lens fitting operations', isActive: true }
    ]
  },
  {
    name: 'DISPATCH',
    code: 'DISPATCH',
    description: 'Order dispatch and logistics',
    subRoles: [
      { name: 'Challan Creation & Print', code: 'CHALLAN', description: 'Create and print delivery challans', isActive: true },
      { name: 'Card Print', code: 'CARD_PRINT', description: 'Print customer cards', isActive: true },
      { name: 'Address Label', code: 'ADDRESS_LABEL', description: 'Generate and print address labels', isActive: true },
      { name: 'Orders Report Access', code: 'ORDERS_REPORT', description: 'Access to orders reports', isActive: true },
      { name: 'Invoice Excel', code: 'INVOICE_EXCEL', description: 'Generate invoice Excel reports', isActive: true }
    ]
  },
  {
    name: 'SALES',
    code: 'SALES',
    description: 'Sales operations and customer management',
    subRoles: [
      { name: 'Sales Head', code: 'SALES_HEAD', description: 'Most senior role - overall sales department leadership', isActive: true },
      { name: 'Regional Head', code: 'REGIONAL_HEAD', description: 'Second most senior role - manages regional operations', isActive: true },
      { name: 'Cluster Head', code: 'CLUSTER_HEAD', description: 'Third senior role - manages cluster of sales executives', isActive: true },
      { name: 'Sales Executive', code: 'SALES_EXECUTIVE', description: 'Most junior role - handles day-to-day sales activities', isActive: true }
    ]
  },
  {
    name: 'STORE',
    code: 'STORE',
    description: 'Inventory and store management',
    subRoles: [
      { name: 'Store Manager', code: 'SM', description: 'Manages overall store operations', isActive: true },
      { name: 'Store Executive', code: 'SE', description: 'Handles store floor operations and customer assistance', isActive: true },
      { name: 'Store Keeper', code: 'SK', description: 'Maintains physical storage and stock organization', isActive: true }
    ]
  },
  {
    name: 'CUSTOMER SUPPORT TEAM',
    code: 'CST',
    description: 'Customer support and service',
    subRoles: [
      { name: 'Customer Support Executive', code: 'CSE', description: 'Handles inbound customer queries and complaints', isActive: true },
      { name: 'Customer Onboarding Specialist', code: 'COS', description: 'Onboards new customers and provides initial training', isActive: true },
      { name: 'Support Quality Analyst', code: 'SQA', description: 'Monitors and ensures quality of support interactions', isActive: true }
    ]
  }
];

const catalogBrandCategoryData = [
  { brand: "ASAHI-LITE", categories: ["AL-Glass SV", "AL-Glass Prog", "AL-Glass KT BF", "AL-Glass D BF", "Asahi Premier", "Asahi Smart Bifocal", "Asahi D Bifocal", "Asahi Excecutive", "Asahi KT Bifocal", "Asahi SV Rx", "Asahi Myo Sharp", "Asahi Standard", "Asahi Advanced", "Asahi FPAL", "Asahi FSV"] },
  { brand: "ASDOL-OEM", categories: ["SOLACE", "Vlite BF", "Vlite DBF", "VISAO LITE", "CLEON", "AURA", "VILITE SV"] },
  { brand: "DIVA", categories: ["Diva KT Bifocal", "Diva Prog"] },
  { brand: "DIVA-RETAIL", categories: ["Diva Prog"] },
  { brand: "DIVA-WHL", categories: ["Diva Prog"] },
  { brand: "LITHOUS-OEM", categories: ["Signature Infinity", "Signature Orbit", "Individual", "Prestige Wide", "Ecoline SV", "Prestige Balanced", "Prime Max", "Prime Easy Fit", "Budget Series", "Anti-Fatigue", "Ecoline DBF", "Ecoline KT", "Smart BF", "Myo Smart", "Apex AI"] },
  { brand: "O2 Lens", categories: ["Divine Prog", "Veco 360 Flexi Advanced", "Veco Phonix Advanced", "Veco Serene Advanced", "Veco Customized SV", "Ultima Elite", "Professional", "Aster Premium", "Super Fit"] },
  { brand: "PIXEL", categories: ["Pixel Prime HD", "Pixel HD Wide", "Pixel Bespoke", "Pixel-Invisible", "KT-Bifocal", "D-Bifocal", "Pixel Relax", "Pixel SV"] },
  { brand: "VE-Dubai", categories: ["VE Single Vision", "Proxima-Office", "Platinum", "Palladium", "KT Bifocal", "Iridium", "Invisible Bifocal", "Gold", "D Bifocal", "AntiFatigue", "Finished SV", "Finished Progressive", "Finished KT"] },
  { brand: "VE-FUJI", categories: ["Pinnacle", "Zenith", "Crest", "Apex", "Apex Lite", "Fuji Sport Tech", "Fuji SV RX", "Fuji Safe Ride", "Fuji Office", "Fuji FSV"] },
  { brand: "VE-SIGNATURE", categories: ["Signature SV RX", "Sport SV RX", "Drive SV RX", "Anti-Fatigue", "Myopia SV", "Invisible BIF", "Sport PAL", "Office", "Pilot", "Drive PAL", "Iridium", "Palladium", "Gold", "Platinum", "Titanium", "Rhodium", "Signature FSV"] },
  { brand: "VISION EASE", categories: ["Narrative Individual", "Narrative", "Everywhere", "Vision Ease SVRx", "Vision Ease FSV"] },
  { brand: "VISUALEYES", categories: ["R+ Wider", "Ocumade SV", "S Wide", "Tailormade", "S+ Wider", "Ocumade No Line", "Ocumade KT", "Ocumade DBF", "Glass Ruby", "Glass Sapphire", "Glass D Bifocal", "Glass KT Bifocal", "Glass SV", "ZIR+ SV-DS", "Sapphire", "Diamond Plus", "Emerald Plus", "Ruby Plus", "Sapphire Plus", "D Bifocal", "Single Vision", "DS Bifocal", "Chorus Opal", "KT Bifocal", "Visualeyes Office Pro", "Ocumade FSV", "VisualEyes FSV"] },
  { brand: "ZIRCON", categories: ["Chorus Clear", "Zircon SVRx", "Zircon Pearl", "Zircon D Bifocal", "Ocumade SV", "Ocumade DBF", "Lifestyle Pal", "Ocumade KT", "Zircon KT Bifocal", "SIGHTX PAL", "SIGHTX BF", "MARBAL PAL", "MARBAL BF", "MARCO PAL", "MARCO BF", "Ocumade FSV"] },
  { brand: "ZIRCON EXCLUSIVE", categories: ["Topaz", "Jade", "Garnet", "Zircon Exclusive RX", "Ocumade SV", "Zircon Exclusive FSV", "Zircon Exclusive FBF", "Zircon Exclusive FPAL", "Ocumade FSV"] }
];

const orderProductBrands = [
  "ASAHI-LITE", "ASDOL-OEM", "DIVA-RETAIL", "DIVA-WHL", "FRAMESKRAFT-OEM",
  "LITHOUS-OEM", "O2 Lens", "PIXEL", "VE-Dubai", "VE-FUJI", "VE-SIGNATURE",
  "VISUALEYES", "WINGS-OEM", "ZIRCON", "ZIRCON EXCLUSIVE"
];

const orderProductCategories = [
  "AL-Glass D BF","AL-Glass KT BF","AL-Glass Prog","AL-Glass SV","AURA","Anti-Fatigue",
  "AntiFatigue","Apex","Apex AI","Apex Lite","Asahi Advanced","Asahi D Bifocal",
  "Asahi Excecutive","Asahi FPAL","Asahi FSV","Asahi KT Bifocal","Asahi Myo Sharp",
  "Asahi Premier","Asahi SV Rx","Asahi Smart Bifocal","Asahi Standard","Aster Premium",
  "Budget Series","CLEON","Chorus Clear","Crest","D Bifocal","D-Bifocal","Diamond Plus",
  "Diva Prog","Divine Prog","Drive PAL","Drive SV RX","Ecoline DBF","Ecoline KT",
  "Ecoline SV","Emerald Plus","Finished KT","Finished Progressive","Finished SV",
  "Fuji FSV","Fuji SV RX","Fuji Safe Ride","Fuji Sport Tech","Garnet","Glass D Bifocal",
  "Glass KT Bifocal","Glass Ruby","Glass SV","Glass Sapphire","Gold","Individual",
  "Invisible BIF","Invisible Bifocal","Iridium","Jade","KT Bifocal","KT-Bifocal",
  "Lenticular-KT","Lenticular-SV","Lifestyle Pal","MARBAL BF","MARBAL PAL","Myo Smart",
  "Myopia SV","Ocumade DBF","Ocumade FSV","Ocumade KT","Ocumade No Line","Ocumade SV",
  "Office","Palladium","Pilot","Pinnacle","Pixel Bespoke","Pixel HD Wide","Pixel Prime HD",
  "Pixel Relax","Pixel SV","Pixel-Invisible","Platinum","Prestige Balanced","Prestige Wide",
  "Prime Easy Fit","Prime Max","Professional","Proxima-Office","R+ Wider","Rhodium",
  "Ruby Plus","S Wide","S+ Wider","SOLACE","Sapphire","Sapphire Plus","Signature FSV",
  "Signature Infinity","Signature Orbit","Signature SV RX","Single Vision","Smart BF",
  "Sport PAL","Sport SV RX","Super Fit","Tailormade","Titanium","Topaz","Ultima Elite",
  "VE Single Vision","VILITE SV","VISAO LITE","Veco 360 Flexi Advanced","Veco Customized SV",
  "Veco Phonix Advanced","Veco Serene Advanced","VisualEyes FSV","Vlite BF","Vlite DBF",
  "Zenith","Zircon D Bifocal","Zircon Exclusive FBF","Zircon Exclusive FPAL",
  "Zircon Exclusive FSV","Zircon Exclusive RX","Zircon KT Bifocal","Zircon Pearl","Zircon SVRx"
];

const coatings = [
  "ACHROMATIC","ACROMA","ARC","ARMOR","BGC","BLUE","BLUEPROTECT","CYAN","DRIVE",
  "DRIVE COAT","DSC","DURATUFF","DURATUFF AQUA","DURATUFF BLUE","DURATUFF GREEN",
  "DURATUFF NIGHT","DURON","EMERY","GREEN","HC","HDC","HMC","LOW REFLECTION","LRC",
  "MAGENTA","NIGHT VISION","O2 DUAL","PEARLON","SHELL","SHIELD","SHMC","SILK PLUS",
  "TRUEBLUE","UC","ULTRON","UTC"
];

const indexes = [1.5, 1.53, 1.55, 1.56, 1.59, 1.6, 1.67, 1.7, 1.74, 1.8, 1.9];

const treatments = [
  "BlueCut", "Clear", "Neochrome", "Photo BlueCut", "Photochromic",
  "Polarised", "Premium Photochromic", "Sunsensors", "Transition", "Transition Polarised"
];

const productTypes = ["Rx Lens", "Stock Lens"];
const frameTypes = ["Rimless", "Supra", "Full"];
const tintOptions = ["Solid", "Gradient", "No Tint", "Mirror-Solid", "Mirror-Gradient", "Sample"];

const standardCOA = [
  // --- ASSETS ---
  { accountCode: '1000', accountName: 'Assets', accountNature: 'Asset', accountType: 'General Ledger', isControlAccount: true, allowManualJournal: false, description: 'Master Assets Group' },
  { accountCode: '1100', accountName: 'Current Assets', accountNature: 'Asset', accountType: 'General Ledger', parentCode: '1000', isControlAccount: true, allowManualJournal: false, description: 'Current Assets' },
  { accountCode: '1110', accountName: 'Accounts Receivable (Trade Debtors)', accountNature: 'Asset', accountType: 'Customer', parentCode: '1100', isControlAccount: true, allowManualJournal: false, description: 'Control account for all customer balances' },
  { accountCode: '1120', accountName: 'Cash on Hand (Main Cash Counter)', accountNature: 'Asset', accountType: 'Cash', parentCode: '1100', isControlAccount: true, allowManualJournal: true, description: 'Cash counter physical cash register' },
  { accountCode: '1130', accountName: 'Primary Bank Account (Current A/C)', accountNature: 'Asset', accountType: 'Bank', parentCode: '1100', isControlAccount: true, allowManualJournal: true, description: 'Main operating current account for transfers/UPI/Cheques' },
  { accountCode: '1140', accountName: 'Advance Paid to Vendors', accountNature: 'Asset', accountType: 'Vendor', parentCode: '1100', isControlAccount: false, allowManualJournal: true, description: 'Advance payments made to vendors prior to invoice' },
  { accountCode: '1150', accountName: 'Inventory (Optical Lenses & Frames)', accountNature: 'Asset', accountType: 'Inventory', parentCode: '1100', isControlAccount: true, allowManualJournal: false, description: 'Total wholesale inventory on hand' },
  { accountCode: '1160', accountName: 'GST Input Tax Credit (ITC Receivable)', accountNature: 'Asset', accountType: 'Tax', parentCode: '1100', isControlAccount: false, allowManualJournal: true, description: 'CGST, SGST, IGST input tax credit' },

  // --- LIABILITIES ---
  { accountCode: '2000', accountName: 'Liabilities', accountNature: 'Liability', accountType: 'General Ledger', isControlAccount: true, allowManualJournal: false, description: 'Master Liabilities Group' },
  { accountCode: '2100', accountName: 'Current Liabilities', accountNature: 'Liability', accountType: 'General Ledger', parentCode: '2000', isControlAccount: true, allowManualJournal: false, description: 'Current Liabilities' },
  { accountCode: '2110', accountName: 'Accounts Payable (Trade Creditors)', accountNature: 'Liability', accountType: 'Vendor', parentCode: '2100', isControlAccount: true, allowManualJournal: false, description: 'Control account for all vendor balances' },
  { accountCode: '2120', accountName: 'Advance Received from Customers', accountNature: 'Liability', accountType: 'Customer', parentCode: '2100', isControlAccount: false, allowManualJournal: true, description: 'Advance received from retail/wholesale customers' },
  { accountCode: '2130', accountName: 'TDS Payable (Tax Deducted at Source)', accountNature: 'Liability', accountType: 'Tax', parentCode: '2100', isControlAccount: false, allowManualJournal: true, description: 'TDS deducted on vendor payouts to be remitted to government' },
  { accountCode: '2140', accountName: 'GST Output Tax Payable', accountNature: 'Liability', accountType: 'Tax', parentCode: '2100', isControlAccount: false, allowManualJournal: true, description: 'Output CGST, SGST, IGST collected on sales' },

  // --- CAPITAL / EQUITY ---
  { accountCode: '3000', accountName: 'Capital & Equity', accountNature: 'Capital', accountType: 'General Ledger', isControlAccount: true, allowManualJournal: false, description: 'Master Capital Group' },
  { accountCode: '3100', accountName: 'Owner Equity / Share Capital', accountNature: 'Capital', accountType: 'General Ledger', parentCode: '3000', isControlAccount: false, allowManualJournal: true, description: 'Partner/Owner invested capital' },

  // --- INCOME ---
  { accountCode: '4000', accountName: 'Income & Revenue', accountNature: 'Income', accountType: 'Income', isControlAccount: true, allowManualJournal: false, description: 'Master Income Group' },
  { accountCode: '4100', accountName: 'Wholesale Lens & Frame Sales Revenue', accountNature: 'Income', accountType: 'Income', parentCode: '4000', isControlAccount: true, allowManualJournal: false, description: 'Gross wholesale invoicing revenue' },
  { accountCode: '4200', accountName: 'Fitting, Coating & Lab Service Charges', accountNature: 'Income', accountType: 'Income', parentCode: '4000', isControlAccount: false, allowManualJournal: true, description: 'Value added surfacing, ARC and fitting service income' },
  { accountCode: '4300', accountName: 'Cheque Bounce Penalty & Late Charges', accountNature: 'Income', accountType: 'Income', parentCode: '4000', isControlAccount: true, allowManualJournal: false, description: '₹500 cheque bounce penalty and overdue charges recovered' },

  // --- EXPENSES ---
  { accountCode: '5000', accountName: 'Expenses', accountNature: 'Expense', accountType: 'Expense', isControlAccount: true, allowManualJournal: false, description: 'Master Expenses Group' },
  { accountCode: '5100', accountName: 'Cost of Goods Sold (Purchases & Consumables)', accountNature: 'Expense', accountType: 'Expense', parentCode: '5000', isControlAccount: true, allowManualJournal: false, description: 'Raw materials, lenses, frames purchased from vendors' },
  { accountCode: '5200', accountName: 'Courier, Shipping & Dispatch Freight', accountNature: 'Expense', accountType: 'Expense', parentCode: '5000', isControlAccount: false, allowManualJournal: true, description: 'Logistics and delivery expenses' },
  { accountCode: '5300', accountName: 'Bank Charges & Payment Processing Fees', accountNature: 'Expense', accountType: 'Expense', parentCode: '5000', isControlAccount: false, allowManualJournal: true, description: 'Bank processing and payment charges' }
];

// ==============================================================================
// 2. MASTER SETUP RUNNER
// ==============================================================================

async function runMasterSetup() {
  console.log('\n' + '='.repeat(78));
  console.log('🚀 DIGIWHOLESALE ERP — MASTER SYSTEM INITIALIZATION & SEEDING');
  console.log('='.repeat(78) + '\n');

  if (!MONGO_URI) {
    console.error('❌ MONGODB_URL is missing in environment variables (.env).');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB successfully\n');

    // --------------------------------------------------------------------------
    // STEP 1: Core System Users & Identity (SuperAdmin & Platform Owner)
    // --------------------------------------------------------------------------
    console.log('───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 1: SuperAdmin & Platform Owner Accounts');
    console.log('───────────────────────────────────────────────────────────────────────────');

    let superAdmin = await Employee.findOne({ EmployeeType: 'SUPERADMIN' });
    if (!superAdmin) {
      console.log('Creating initial SuperAdmin account...');
      const superAdminData = {
        username: 'Ruchica G',
        employeeName: 'Ruchica',
        email: 'ruchica@digibysr.com',
        password: 'director',
        phone: '9899119993',
        address: 'Hauz Khas new delhi india',
        country: 'India',
        pincode: '123456',
        EmployeeType: 'SUPERADMIN',
        Department: { name: 'SUPERADMIN', refId: null },
        isActive: true,
        pageAccess: [],
        accessPermissions: [],
        profile: { dateOfJoining: new Date() }
      };

      let code = generateEmployeeCode(superAdminData.employeeName);
      while (await Employee.findOne({ employeeCode: code })) {
        code = generateEmployeeCode(superAdminData.employeeName);
      }
      superAdminData.employeeCode = code;

      superAdmin = new Employee(superAdminData);
      await superAdmin.save();
      console.log(`✅ SuperAdmin created: ${superAdmin.email} (${superAdmin.username})`);
    } else {
      console.log(`ℹ️  SuperAdmin already exists: ${superAdmin.email} (${superAdmin.username})`);
    }

    const platformOwnerEmail = 'owner@digibysr.com';
    let platformOwnerEmployee = await Employee.findOne({ email: platformOwnerEmail });
    if (!platformOwnerEmployee) {
      console.log('Creating Platform Owner employee account...');
      platformOwnerEmployee = new Employee({
        employeeName: 'Platform Owner',
        username: 'platformowner',
        email: platformOwnerEmail,
        password: 'Owner@2026',
        phone: '0000000000',
        address: 'Platform HQ',
        country: 'India',
        EmployeeType: 'PLATFORM_OWNER',
        employeeCode: `PO${Date.now()}`,
        tenantId: null,
        isActive: true,
        pageAccess: [],
        accessPermissions: []
      });
      await platformOwnerEmployee.save();
      console.log(`✅ Platform Owner Employee created: ${platformOwnerEmail}`);
    } else {
      console.log(`ℹ️  Platform Owner Employee already exists: ${platformOwnerEmail}`);
    }

    // Also ensure PlatformOwner model collection has a matching record
    let poModelDoc = await PlatformOwner.findOne({ email: platformOwnerEmail });
    if (!poModelDoc) {
      poModelDoc = new PlatformOwner({
        name: 'Platform Owner',
        email: platformOwnerEmail,
        password: 'Owner@2026',
        phone: '0000000000',
        isActive: true
      });
      await poModelDoc.save();
      console.log(`✅ PlatformOwner record created in PlatformOwners collection`);
    } else {
      console.log(`ℹ️  PlatformOwner record already exists in PlatformOwners collection`);
    }

    const createdBy = superAdmin._id;
    const defaultTenantId = superAdmin.tenantId || process.env.DEFAULT_TENANT_ID || 'DEFAULT';

    // --------------------------------------------------------------------------
    // STEP 2: System Config (SystemConfig)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 2: System Configurations (SystemConfig - EmployeeType, Lab, Region)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    for (const [configType, values] of Object.entries(systemConfigData)) {
      await SystemConfig.findOneAndUpdate(
        { configType },
        { configType, values, createdBy, tenantId: defaultTenantId },
        { upsert: true, new: true }
      );
    }
    console.log(`✅ Seeded SystemConfig: ${Object.keys(systemConfigData).join(', ')}`);

    // --------------------------------------------------------------------------
    // STEP 3: Customer Dropdown Masters (States, GST Types, Business Types, etc.)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 3: Customer Master Dropdowns (States, GST Types, Courier, Plants, Labs)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    // 3A. States
    for (const name of indianStates) {
      await State.findOneAndUpdate({ name }, { name, createdBy, isActive: true }, { upsert: true });
    }
    console.log(`✅ Seeded ${indianStates.length} Indian States & UTs`);

    // 3B. GST Types
    for (const name of gstTypes) {
      await GSTType.findOneAndUpdate({ name }, { name, createdBy, isActive: true }, { upsert: true });
    }
    console.log(`✅ Seeded ${gstTypes.length} GST Types (${gstTypes.join(', ')})`);

    // 3C. Business Types
    for (const name of businessTypes) {
      await BusinessType.findOneAndUpdate({ name }, { name, createdBy, isActive: true }, { upsert: true });
    }
    console.log(`✅ Seeded ${businessTypes.length} Business Types`);

    // 3D. Countries
    for (const name of countries) {
      await Country.findOneAndUpdate({ name }, { name, createdBy, isActive: true }, { upsert: true });
    }
    console.log(`✅ Seeded ${countries.length} Countries`);

    // 3E. Billing Currencies
    for (const name of billingCurrencies) {
      await BillingCurrency.findOneAndUpdate({ name }, { name, createdBy, isActive: true }, { upsert: true });
    }
    console.log(`✅ Seeded ${billingCurrencies.length} Billing Currencies`);

    // 3F. Credit Days
    for (const days of creditDays) {
      await CreditDay.findOneAndUpdate({ days }, { days, createdBy, isActive: true }, { upsert: true });
    }
    console.log(`✅ Seeded ${creditDays.length} Credit Day options`);

    // 3G. Courier Names & Times
    for (const name of courierNames) {
      await CourierName.findOneAndUpdate(
        { name, tenantId: defaultTenantId },
        { name, createdBy, isActive: true, tenantId: defaultTenantId },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${courierNames.length} Courier Names`);

    for (const item of courierTimes) {
      await CourierTime.findOneAndUpdate(
        { location: item.location, time: item.time },
        { ...item, createdBy, isActive: true },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${courierTimes.length} Courier Time schedules`);

    // 3H. Plants & Fitting Centers
    for (const name of plants) {
      await Plant.findOneAndUpdate(
        { name, tenantId: defaultTenantId },
        { name, createdBy, isActive: true, tenantId: defaultTenantId },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${plants.length} Production Plants`);

    for (const name of fittingCenters) {
      await FittingCenter.findOneAndUpdate(
        { name, tenantId: defaultTenantId },
        { name, createdBy, isActive: true, tenantId: defaultTenantId },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${fittingCenters.length} Fitting Centers`);

    // 3I. Labs & Specific Labs
    for (const name of basicLabs) {
      await Lab.findOneAndUpdate(
        { name, tenantId: defaultTenantId },
        { name, createdBy, isActive: true, tenantId: defaultTenantId },
        { upsert: true }
      );
    }
    for (const name of specificLabs) {
      await SpecificLab.findOneAndUpdate(
        { name, tenantId: defaultTenantId },
        { name, createdBy, isActive: true, tenantId: defaultTenantId },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${basicLabs.length} Basic Labs & ${specificLabs.length} Specific Regional Labs`);

    // --------------------------------------------------------------------------
    // STEP 4: Unified Geographic Locations (Location Model)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 4: Unified Geographic Locations (Zones, Cities, Area Pincodes)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    let totalStates = 0;
    let totalCities = 0;
    let totalZipCodes = 0;

    for (const loc of locationData) {
      const existingLoc = await Location.findOne({ zone: loc.zone });
      if (!existingLoc) {
        await Location.create({ ...loc, createdBy, isActive: true, tenantId: defaultTenantId });
      } else {
        await Location.updateOne(
          { zone: loc.zone },
          { $set: { states: loc.states, description: loc.description, tenantId: defaultTenantId } }
        );
      }

      const sCount = loc.states.length;
      const cCount = loc.states.reduce((s, st) => s + st.cities.length, 0);
      const zCount = loc.states.reduce((s, st) => s + st.cities.reduce((cz, c) => cz + c.zipCodes.length, 0), 0);
      totalStates += sCount;
      totalCities += cCount;
      totalZipCodes += zCount;
    }
    console.log(`✅ Seeded ${locationData.length} Geographic Zones (${totalStates} States, ${totalCities} Cities, ${totalZipCodes} Area Pincodes)`);

    // --------------------------------------------------------------------------
    // STEP 5: Departments & Complete Organizational Sub-Roles
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 5: Departments & Complete Sub-Role Hierarchies');
    console.log('───────────────────────────────────────────────────────────────────────────');

    for (const dept of departmentsData) {
      await Department.findOneAndUpdate(
        { code: dept.code },
        {
          name: dept.name,
          code: dept.code,
          description: dept.description,
          subRoles: dept.subRoles,
          createdBy,
          tenantId: defaultTenantId,
          isActive: true
        },
        { upsert: true, new: true }
      );
      console.log(`  ✓ ${dept.name} (${dept.code}) — ${dept.subRoles.length} sub-roles`);
    }
    console.log(`✅ Seeded ${departmentsData.length} Functional Departments & Hierarchies`);

    // --------------------------------------------------------------------------
    // STEP 6: Product & Order Attribute Dropdowns
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 6: Product Order Attributes (Coatings, Indexes, Treatments, Frame Types, Tints)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    for (const name of orderProductBrands) {
      await ProductBrand.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${orderProductBrands.length} Order Product Brands`);

    for (const name of orderProductCategories) {
      await ProductCategory.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${orderProductCategories.length} Order Product Categories`);

    for (const name of coatings) {
      await ProductCoating.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${coatings.length} Product Coatings`);

    for (const value of indexes) {
      await ProductIndex.findOneAndUpdate({ value }, { value, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${indexes.length} Product Indexes (${indexes.join(', ')})`);

    for (const name of treatments) {
      await ProductTreatment.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${treatments.length} Product Treatments`);

    for (const name of productTypes) {
      await ProductType.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${productTypes.length} Product Types (${productTypes.join(', ')})`);

    for (const name of frameTypes) {
      await FrameType.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${frameTypes.length} Frame Types (${frameTypes.join(', ')})`);

    for (const name of tintOptions) {
      await Tint.findOneAndUpdate({ name }, { name, isActive: true, createdBy }, { upsert: true });
    }
    console.log(`✅ Seeded ${tintOptions.length} Tint Options (${tintOptions.join(', ')})`);

    // --------------------------------------------------------------------------
    // STEP 7: Catalog Lens Brands & Nested Categories (Brand & Category)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 7: Catalog Lens Brands & Categories (Inventory / Catalog Matrix)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    let totalCatalogCategories = 0;
    for (const item of catalogBrandCategoryData) {
      const upperBrand = item.brand.trim().toUpperCase();
      const brandDoc = await Brand.findOneAndUpdate(
        { name: upperBrand, tenantId: defaultTenantId },
        { name: upperBrand, createdBy, isActive: true, tenantId: defaultTenantId },
        { upsert: true, new: true }
      );

      for (const catName of item.categories) {
        await Category.findOneAndUpdate(
          { name: catName.trim(), brand: brandDoc._id, tenantId: defaultTenantId },
          { name: catName.trim(), brand: brandDoc._id, createdBy, isActive: true, tenantId: defaultTenantId },
          { upsert: true }
        );
        totalCatalogCategories++;
      }
    }
    console.log(`✅ Seeded ${catalogBrandCategoryData.length} Catalog Brands with ${totalCatalogCategories} Nested Categories`);

    // --------------------------------------------------------------------------
    // STEP 8: Chart of Accounts (COA)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 8: Standard Chart of Accounts (COA)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    for (const item of standardCOA) {
      await Account.findOneAndUpdate(
        { accountCode: item.accountCode },
        {
          accountCode: item.accountCode,
          accountName: item.accountName,
          accountNature: item.accountNature,
          accountType: item.accountType,
          isControlAccount: item.isControlAccount || false,
          allowManualJournal: item.allowManualJournal !== undefined ? item.allowManualJournal : true,
          description: item.description,
          status: 'Active',
          createdBy,
          tenantId: defaultTenantId
        },
        { upsert: true, new: true }
      );
    }

    // Second pass: link parentAccount ObjectIds
    for (const item of standardCOA) {
      if (item.parentCode) {
        const parent = await Account.findOne({ accountCode: item.parentCode });
        if (parent) {
          await Account.updateOne(
            { accountCode: item.accountCode },
            { $set: { parentAccount: parent._id } }
          );
        }
      }
    }
    console.log(`✅ Seeded & Linked ${standardCOA.length} Standard COA Ledger Accounts`);

    // --------------------------------------------------------------------------
    // STEP 9: Default Primary Operating Bank Account (BankAccount)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 9: Default Primary Bank Account (Banking & Settlement)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    let primaryBank = await BankAccount.findOne({ tenantId: defaultTenantId, isDefault: true });
    if (!primaryBank) {
      primaryBank = await BankAccount.findOneAndUpdate(
        { accountNumber: '50100000000005', tenantId: defaultTenantId },
        {
          bankName: 'HDFC Bank',
          accountHolderName: 'DigiWholesale ERP',
          accountNumber: '50100000000005',
          ifscCode: 'HDFC0000005',
          branchName: 'Main Branch',
          accountType: 'Savings',
          upiId: 'anishsinghrawat5@oksbi',
          isDefault: true,
          isActive: true,
          description: 'Primary Operating Bank Account for Payments & Settlements',
          createdBy,
          tenantId: defaultTenantId
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Default Primary Bank Account created: ${primaryBank.bankName} (${primaryBank.accountNumber})`);
    } else {
      console.log(`ℹ️  Default Primary Bank Account already exists: ${primaryBank.bankName} (${primaryBank.accountNumber})`);
    }

    // --------------------------------------------------------------------------
    // STEP 10: Default Vendor Master (Vendor)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 10: Default Vendor Master (Purchases & Sourcing)');
    console.log('───────────────────────────────────────────────────────────────────────────');

    const defaultVendorEmail = 'testingd12221@gmail.com';
    let defaultVendor = await Vendor.findOne({ email: defaultVendorEmail });
    if (!defaultVendor) {
      defaultVendor = await Vendor.create({
        name: 'ANISH SINGH RAWAT',
        firm: 'ANISH SINGH RAWAT',
        mobile: '916395607666',
        email: defaultVendorEmail,
        address: 'NEW DELHI, INDIA',
        gstNumber: '',
        paymentTerms: 'CASH',
        creditLimit: 0,
        notes: 'Default seeded vendor master',
        tenantId: defaultTenantId
      });
      console.log(`✅ Default Vendor created: ${defaultVendor.name} (${defaultVendor.email})`);
    } else {
      console.log(`ℹ️  Default Vendor already exists: ${defaultVendor.name} (${defaultVendor.email})`);
    }

    // --------------------------------------------------------------------------
    // STEP 11: Core ERP Settings Defaults (Settings)
    // --------------------------------------------------------------------------
    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('STEP 11: General System Settings Defaults');
    console.log('───────────────────────────────────────────────────────────────────────────');

    await Settings.findOneAndUpdate(
      { tenantId: defaultTenantId },
      {
        $setOnInsert: {
          tenantId: defaultTenantId,
          allCategories: ['Single Vision', 'Bifocal', 'Progressive'],
          gst: ['0%', '5%', '12%', '18%', '28%'],
          paymentFor: ['Order', 'Advance', 'Adjustment'],
          salesPaymentFor: ['Sale', 'Return', 'Exchange'],
          status: ['Pending', 'Processing', 'Completed', 'Cancelled'],
          transactionType: ['Credit', 'Debit']
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Core ERP Settings verified and seeded');

    // --------------------------------------------------------------------------
    // COMPLETION SUMMARY
    // --------------------------------------------------------------------------
    console.log('\n' + '='.repeat(78));
    console.log('🎉 MASTER SETUP & SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(78));
    console.log(`
Summary of Initialized Systems:
  • SuperAdmin Account        : ${superAdmin.email}
  • Platform Owner Account    : ${platformOwnerEmail}
  • System Config Groups      : EmployeeType, Lab, Region
  • Indian States & UTs       : ${indianStates.length}
  • Customer GST & Biz Types  : ${gstTypes.length} GST Types, ${businessTypes.length} Business Types
  • Courier & Logistics       : ${courierNames.length} Couriers, ${courierTimes.length} Schedule Slots
  • Plants, Labs & Fitting    : ${plants.length} Plants, ${basicLabs.length} Basic Labs, ${specificLabs.length} Regional Labs
  • Geographic Locations      : ${locationData.length} Zones (${totalStates} States, ${totalCities} Cities, ${totalZipCodes} Pincodes)
  • Departments & Sub-Roles   : ${departmentsData.length} Departments (Finance, Lab, Dispatch, Sales, Store, CST)
  • Order Metadata Dropdowns  : ${orderProductBrands.length} Brands, ${orderProductCategories.length} Categories, ${coatings.length} Coatings, ${indexes.length} Indexes
  • Catalog Brands & Lenses   : ${catalogBrandCategoryData.length} Brands (${totalCatalogCategories} Categories)
  • Standard Chart of Accounts: ${standardCOA.length} Hierarchical Accounts
  • Primary Bank Account      : ${primaryBank.bankName} - ${primaryBank.accountNumber}
  • Default Vendor            : ${defaultVendor.name} (${defaultVendor.email})
  • Default Settings          : Initialized for Tenant ${defaultTenantId}
    `);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Master setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed.');
  }
}

runMasterSetup();
