import { Injectable } from '@angular/core';

export interface VehiclePricing {
  vehicleType: string;
  dailyPrice: number;
  monthlyPrice: number;
}

@Injectable({
  providedIn: 'root'
})
export class VehicleTypeAndpriceDetailsService {

  constructor() { }


  vehiclePricing: VehiclePricing[] = [
    {
      vehicleType: 'Car',
      dailyPrice: 50,
      monthlyPrice: 1200
    },
    {
      vehicleType: 'Bike',
      dailyPrice: 20,
      monthlyPrice: 500
    },
    {
      vehicleType: 'Lorry',
      dailyPrice: 100,
      monthlyPrice: 3000
    }
  ];
  

  getVehicleTypes(): string[] {
    return this.vehiclePricing.map(v => v.vehicleType);
  }

  // 2️⃣ Get price based on customer type
  getPrice(
    vehicleType: string,
    customerType: 'Daily' | 'Monthly'
  ): number | null {
    const vehicle = this.vehiclePricing.find(v => v.vehicleType === vehicleType);
    if (!vehicle) return null;

    return customerType === 'Daily'
      ? vehicle.dailyPrice
      : vehicle.monthlyPrice;
  }

  // 3️⃣ Update price (Admin)
  updatePrice(
    vehicleType: string,
    customerType: 'Daily' | 'Monthly',
    price: number
  ): void {
    const vehicle = this.vehiclePricing.find(v => v.vehicleType === vehicleType);
    if (!vehicle) return;

    if (customerType === 'Daily') {
      vehicle.dailyPrice = price;
    } else {
      vehicle.monthlyPrice = price;
    }
  }

  // 4️⃣ Add new vehicle type
  addVehicle(
    vehicleType: string,
    dailyPrice: number,
    monthlyPrice: number
  ): void {
    this.vehiclePricing.push({ vehicleType, dailyPrice, monthlyPrice });
  }

  // 5️⃣ Optional: get full pricing list (Admin view)
  getAllPricing(): VehiclePricing[] {
    return [...this.vehiclePricing];
  }
}
