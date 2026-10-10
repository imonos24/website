/** Frontend catalog of locations available in the forecast selectors. */
export type LocationOption = {
  id: string;
  name: string;
  level: 'state' | 'district';
  parent_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const states: LocationOption[] = [
  {
    "id": "adm1:IND_ADM1_1_3_3_0",
    "name": "Tamil Nadu",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_2",
    "name": "Himachal Pradesh",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_3",
    "name": "Uttarakhand",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_4",
    "name": "Sikkim",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_5",
    "name": "Delhi",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_6",
    "name": "Uttar Pradesh",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_7",
    "name": "Haryana",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_8",
    "name": "Punjab",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_10",
    "name": "Rajasthan",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_12",
    "name": "Gujarat",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_13",
    "name": "Madhya Pradesh",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_14",
    "name": "Maharashtra",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_17",
    "name": "Bihar",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_18",
    "name": "West Bengal",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_19",
    "name": "Jharkhand",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_20",
    "name": "Chhattisgarh",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_21",
    "name": "Odisha",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_22",
    "name": "Goa",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_23",
    "name": "Kerala",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_24",
    "name": "Karnataka",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_25",
    "name": "Andhra Pradesh",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_27",
    "name": "Assam",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_28",
    "name": "Tripura",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_29",
    "name": "Arunachal Pradesh",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_31",
    "name": "Meghalaya",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_32",
    "name": "Manipur",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_33",
    "name": "Nagaland",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_34",
    "name": "Mizoram",
    "level": "state"
  },
  {
    "id": "adm1:IND_ADM1_1_3_3_35",
    "name": "Telangana",
    "level": "state"
  }
];

export const districts: LocationOption[] = [
  {
    "id": "adm2:IND_ADM2_1_3_3_1",
    "name": "Agra",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_6"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_4",
    "name": "Aizawl",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_34"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_13",
    "name": "Ambala",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_7"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_17",
    "name": "Amritsar",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_8"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_62",
    "name": "Bathinda",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_8"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_69",
    "name": "Bhagalpur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_17"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_73",
    "name": "Bhavnagar",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_12"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_78",
    "name": "Bhopal",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_13"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_84",
    "name": "Bikaner",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_10"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_85",
    "name": "Bilaspur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_20"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_88",
    "name": "Bishnupur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_32"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_89",
    "name": "Bokaro",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_19"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_102",
    "name": "Champhai",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_34"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_110",
    "name": "Chennai",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_0"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_120",
    "name": "Churachandpur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_32"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_122",
    "name": "Coimbatore",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_0"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_125",
    "name": "Cuttack",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_21"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_132",
    "name": "Darbhanga",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_17"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_139",
    "name": "Dehradun",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_3"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_145",
    "name": "Dhanbad",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_19"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_155",
    "name": "Dibrugarh",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_27"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_163",
    "name": "Durg",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_20"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_164",
    "name": "Dimapur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_33"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_178",
    "name": "Faridabad",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_7"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_196",
    "name": "Gaya",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_17"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_210",
    "name": "Guntur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_25"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_213",
    "name": "Gwalior",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_13"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_225",
    "name": "Hazaribagh",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_19"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_227",
    "name": "Hisar",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_7"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_231",
    "name": "Hyderabad",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_35"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_235",
    "name": "Indore",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_13"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_236",
    "name": "Jabalpur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_13"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_239",
    "name": "Jaipur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_10"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_242",
    "name": "Jalandhar",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_8"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_261",
    "name": "Jodhpur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_10"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_262",
    "name": "Jorhat",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_27"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_285",
    "name": "Karimnagar",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_35"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_296",
    "name": "Khammam",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_35"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_308",
    "name": "Kohima",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_33"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_311",
    "name": "Kolasib",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_34"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_313",
    "name": "Kolkata",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_18"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_314",
    "name": "Kollam",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_23"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_317",
    "name": "Korba",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_20"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_319",
    "name": "Kota",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_10"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_321",
    "name": "Kozhikode",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_23"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_344",
    "name": "Lucknow",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_6"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_345",
    "name": "Ludhiana",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_8"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_346",
    "name": "Lunglei",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_34"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_349",
    "name": "Madurai",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_0"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_362",
    "name": "Mandi",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_2"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_376",
    "name": "Mokokchung",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_33"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_381",
    "name": "Mumbai",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_14"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_386",
    "name": "Muzaffarpur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_17"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_392",
    "name": "Nagpur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_14"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_403",
    "name": "Nashik",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_14"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_409",
    "name": "New Delhi",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_5"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_410",
    "name": "Nizamabad",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_35"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_428",
    "name": "Panipat",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_7"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_437",
    "name": "Patiala",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_8"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_438",
    "name": "Patna",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_17"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_451",
    "name": "Pune",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_14"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_455",
    "name": "Puri",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_21"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_462",
    "name": "Raipur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_20"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_466",
    "name": "Rajkot",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_12"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_474",
    "name": "Ranchi",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_19"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_493",
    "name": "Saiha",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_34"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_494",
    "name": "Salem",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_0"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_517",
    "name": "Shimla",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_2"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_536",
    "name": "Solan",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_2"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_554",
    "name": "Surat",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_12"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_559",
    "name": "Tawang",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_29"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_567",
    "name": "Thiruvananthapuram",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_23"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_570",
    "name": "Thoubal",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_32"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_571",
    "name": "Thrissur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_23"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_575",
    "name": "Tiruchirappalli",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_0"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_580",
    "name": "Tuensang",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_33"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_582",
    "name": "Udaipur",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_10"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_587",
    "name": "Ujjain",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_13"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_588",
    "name": "Ukhrul",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_32"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_597",
    "name": "Vadodara",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_12"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_600",
    "name": "Varanasi",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_6"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_605",
    "name": "Visakhapatnam",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_25"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_607",
    "name": "Warangal",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_35"
  },
  {
    "id": "adm2:IND_ADM2_1_3_3_620",
    "name": "Wokha",
    "level": "district",
    "parent_id": "adm1:IND_ADM1_1_3_3_33"
  }
];
