export interface Response {
	data: {
		coopResult: {
			monthlyGear: MonthlyGear;
		};
	};
}
export interface MonthlyGear {
	__splatoon3ink_id: string;
	__typename: "ClothingGear";
	name: string;
	image: {
		url: string;
	};
}
