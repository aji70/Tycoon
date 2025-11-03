use starknet::ContractAddress;

#[derive(Serde, Copy, Drop, Introspect, PartialEq)]
#[dojo::model]
pub struct TradeCounter {
    #[key]
    pub id: felt252,
    pub current_val: u256,
}

#[derive(Clone, Drop, Serde)]
#[dojo::model]
pub struct TradeOfferDetails {
    #[key]
    pub id: u256,
    pub from: ContractAddress,
    pub to: ContractAddress,
    pub game_id: u256,
    pub offered_property_ids: Array<u8>,  // Removed: Dynamic arrays not supported in Dojo models
    pub requested_property_ids: Array<u8>,  // Removed: Dynamic arrays not supported in Dojo models
    pub cash_offer: u256,
    pub cash_request: u256,
    pub trade_type: felt252,  // Changed to felt252 for storage
    pub status: felt252,  // Changed to felt252 for storage
    pub is_countered: bool,
    pub approve_counter: bool,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Property {
    #[key]
    pub id: u8,
    #[key]
    pub game_id: u256,
    pub name: felt252,
    pub owner: ContractAddress,
    pub property_type: felt252,  // Changed to felt252 for storage
    pub cost_of_property: u256,
    pub property_level: u8,
    pub rent_site_only: u256,
    pub rent_one_house: u256,
    pub rent_two_houses: u256,
    pub rent_three_houses: u256,
    pub rent_four_houses: u256,
    pub cost_of_house: u256,
    pub rent_hotel: u256,
    pub is_mortgaged: bool,
    pub group_id: u8,
    pub for_sale: bool,
    pub development: u8,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug)]
pub enum PropertyType {
    Go,
    Chance,
    CommunityChest,
    Jail,
    Utility,
    RailRoad,
    Tax,
    FreeParking,
    Property,
    VisitingJail,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug)]
pub enum TradeOffer {
    PropertyForProperty,
    PropertyForCash,
    CashForProperty,
    CashPlusPropertyForProperty,
    PropertyForCashPlusProperty,
    CashForChanceJailCard,
    CashForCommunityJailCard,
    CommunityJailCardForCash,
    ChanceJailCardForCash,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug)]
pub enum TradeStatus {
    Accepted,
    Rejected,
    Pending,
    Countered,
}

#[derive(Drop, Copy, Serde)]
#[dojo::model]
pub struct PropertyToId {
    #[key]
    pub name: felt252,
    pub id: u8,
}

#[derive(Drop, Copy, Serde)]
#[dojo::model]
pub struct IdToProperty {
    #[key]
    pub id: u8,
    pub name: felt252,
}

pub trait PropertyTrait {
    fn new(
        id: u8,
        game_id: u256,
        name: felt252,
        cost: u256,
        property_type_felt: felt252,  // Updated to receive felt252
        rent_site_only: u256,
        rent_one_house: u256,
        rent_two_houses: u256,
        rent_three_houses: u256,
        rent_four_houses: u256,
        cost_of_house: u256,
        rent_hotel: u256,
        group_id: u8,
        owner: ContractAddress,
    ) -> Property;
    fn get_rent_amount(
        self: Property, owner_railroads: u8, owner_utilities: u8, dice_rolled: u256,
    ) -> u256;
    fn calculate_utility_rent(self: @Property, no_of_utilities: u8, dice_rolled: u256) -> u256;
    fn calculate_railway_rent(self: @Property, no_of_railways: u8) -> u256;
    fn mortgage(ref self: Property, owner: ContractAddress);
    fn lift_mortgage(ref self: Property, owner: ContractAddress);
    fn upgrade_property(ref self: Property, player: ContractAddress, upgrade_level: u8) -> bool;
    fn downgrade_property(ref self: Property, player: ContractAddress, downgrade_level: u8) -> bool;
    fn change_game_property_ownership(
        ref self: Property, new_owner: ContractAddress, owner: ContractAddress,
    ) -> bool;
}

// Conversion implementations for PropertyType
impl PropertyTypeIntoFelt252 of Into<PropertyType, felt252> {
    fn into(self: PropertyType) -> felt252 {
        match self {
            PropertyType::Go => 'GO',
            PropertyType::Chance => 'CHANCE',
            PropertyType::CommunityChest => 'COMMUNITYCHEST',
            PropertyType::Jail => 'JAIL',
            PropertyType::Utility => 'UTILITY',
            PropertyType::RailRoad => 'RAILROAD',
            PropertyType::Tax => 'TAX',
            PropertyType::FreeParking => 'FREEPARKING',
            PropertyType::Property => 'PROPERTY',
            PropertyType::VisitingJail => 'VISITINGJAIL',
        }
    }
}

impl Felt252TryIntoPropertyType of TryInto<felt252, PropertyType> {
    fn try_into(self: felt252) -> Option<PropertyType> {
        if self == 'GO' {
            Option::Some(PropertyType::Go)
        } else if self == 'CHANCE' {
            Option::Some(PropertyType::Chance)
        } else if self == 'COMMUNITYCHEST' {
            Option::Some(PropertyType::CommunityChest)
        } else if self == 'JAIL' {
            Option::Some(PropertyType::Jail)
        } else if self == 'UTILITY' {
            Option::Some(PropertyType::Utility)
        } else if self == 'RAILROAD' {
            Option::Some(PropertyType::RailRoad)
        } else if self == 'TAX' {
            Option::Some(PropertyType::Tax)
        } else if self == 'FREEPARKING' {
            Option::Some(PropertyType::FreeParking)
        } else if self == 'PROPERTY' {
            Option::Some(PropertyType::Property)
        } else if self == 'VISITINGJAIL' {
            Option::Some(PropertyType::VisitingJail)
        } else {
            Option::None
        }
    }
}

// Trait for PropertyType utilities
#[generate_trait]
impl PropertyTypeImpl of PropertyTypeTrait {
    fn all() -> Array<PropertyType> {
        array![
            PropertyType::Go,
            PropertyType::Chance,
            PropertyType::CommunityChest,
            PropertyType::Jail,
            PropertyType::Utility,
            PropertyType::RailRoad,
            PropertyType::Tax,
            PropertyType::FreeParking,
            PropertyType::Property,
            PropertyType::VisitingJail,
        ]
    }

    fn is_valid(type_felt: felt252) -> bool {
        let result: Option<PropertyType> = type_felt.try_into();
        result.is_some()
    }
}

// Conversion implementations for TradeOffer
impl TradeOfferIntoFelt252 of Into<TradeOffer, felt252> {
    fn into(self: TradeOffer) -> felt252 {
        match self {
            TradeOffer::PropertyForProperty => 'PROPERTYFORPROPERTY',
            TradeOffer::PropertyForCash => 'PROPERTYFORCASH',
            TradeOffer::CashForProperty => 'CASHFORPROPERTY',
            TradeOffer::CashPlusPropertyForProperty => 'CASPLUSPROPERTYFORPROPERTY',
            TradeOffer::PropertyForCashPlusProperty => 'PROPERTYFORCASPLUSPROPERTY',
            TradeOffer::CashForChanceJailCard => 'CASHFORCHANCEJAILCARD',
            TradeOffer::CashForCommunityJailCard => 'CASHFORCOMMUNITYJAILCARD',
            TradeOffer::CommunityJailCardForCash => 'COMMUNITYJAILCARDFORCASH',
            TradeOffer::ChanceJailCardForCash => 'CHANCEJAILCARDFORCASH',
        }
    }
}

impl Felt252TryIntoTradeOffer of TryInto<felt252, TradeOffer> {
    fn try_into(self: felt252) -> Option<TradeOffer> {
        if self == 'PROPERTYFORPROPERTY' {
            Option::Some(TradeOffer::PropertyForProperty)
        } else if self == 'PROPERTYFORCASH' {
            Option::Some(TradeOffer::PropertyForCash)
        } else if self == 'CASHFORPROPERTY' {
            Option::Some(TradeOffer::CashForProperty)
        } else if self == 'CASPLUSPROPERTYFORPROPERTY' {
            Option::Some(TradeOffer::CashPlusPropertyForProperty)
        } else if self == 'PROPERTYFORCASPLUSPROPERTY' {
            Option::Some(TradeOffer::PropertyForCashPlusProperty)
        } else if self == 'CASHFORCHANCEJAILCARD' {
            Option::Some(TradeOffer::CashForChanceJailCard)
        } else if self == 'CASHFORCOMMUNITYJAILCARD' {
            Option::Some(TradeOffer::CashForCommunityJailCard)
        } else if self == 'COMMUNITYJAILCARDFORCASH' {
            Option::Some(TradeOffer::CommunityJailCardForCash)
        } else if self == 'CHANCEJAILCARDFORCASH' {
            Option::Some(TradeOffer::ChanceJailCardForCash)
        } else {
            Option::None
        }
    }
}

// Trait for TradeOffer utilities
#[generate_trait]
impl TradeOfferImpl of TradeOfferTrait {
    fn all() -> Array<TradeOffer> {
        array![
            TradeOffer::PropertyForProperty,
            TradeOffer::PropertyForCash,
            TradeOffer::CashForProperty,
            TradeOffer::CashPlusPropertyForProperty,
            TradeOffer::PropertyForCashPlusProperty,
            TradeOffer::CashForChanceJailCard,
            TradeOffer::CashForCommunityJailCard,
            TradeOffer::CommunityJailCardForCash,
            TradeOffer::ChanceJailCardForCash,
        ]
    }

    fn is_valid(offer_felt: felt252) -> bool {
        let result: Option<TradeOffer> = offer_felt.try_into();
        result.is_some()
    }
}

// Conversion implementations for TradeStatus
impl TradeStatusIntoFelt252 of Into<TradeStatus, felt252> {
    fn into(self: TradeStatus) -> felt252 {
        match self {
            TradeStatus::Accepted => 'ACCEPTED',
            TradeStatus::Rejected => 'REJECTED',
            TradeStatus::Pending => 'PENDING',
            TradeStatus::Countered => 'COUNTERED',
        }
    }
}

impl Felt252TryIntoTradeStatus of TryInto<felt252, TradeStatus> {
    fn try_into(self: felt252) -> Option<TradeStatus> {
        if self == 'ACCEPTED' {
            Option::Some(TradeStatus::Accepted)
        } else if self == 'REJECTED' {
            Option::Some(TradeStatus::Rejected)
        } else if self == 'PENDING' {
            Option::Some(TradeStatus::Pending)
        } else if self == 'COUNTERED' {
            Option::Some(TradeStatus::Countered)
        } else {
            Option::None
        }
    }
}

// Trait for TradeStatus utilities
#[generate_trait]
impl TradeStatusImpl of TradeStatusTrait {
    fn all() -> Array<TradeStatus> {
        array![
            TradeStatus::Accepted,
            TradeStatus::Rejected,
            TradeStatus::Pending,
            TradeStatus::Countered,
        ]
    }

    fn is_valid(status_felt: felt252) -> bool {
        let result: Option<TradeStatus> = status_felt.try_into();
        result.is_some()
    }

    fn is_active(status_felt: felt252) -> bool {
        status_felt == 'PENDING' || status_felt == 'COUNTERED'
    }
}

impl PropertyImpl of PropertyTrait {
    fn new(
        id: u8,
        game_id: u256,
        name: felt252,
        cost: u256,
        property_type_felt: felt252,  // Accepts felt252
        rent_site_only: u256,
        rent_one_house: u256,
        rent_two_houses: u256,
        rent_three_houses: u256,
        rent_four_houses: u256,
        cost_of_house: u256,
        rent_hotel: u256,
        group_id: u8,
        owner: ContractAddress,
    ) -> Property {
        Property {
            id,
            game_id,
            name,
            owner: owner,
            property_type: property_type_felt,  // Stored directly as felt252
            cost_of_property: cost,
            property_level: 0,
            rent_site_only: rent_site_only,
            rent_one_house: rent_one_house,
            rent_two_houses: rent_two_houses,
            rent_three_houses: rent_three_houses,
            rent_four_houses: rent_four_houses,
            rent_hotel: rent_hotel,
            cost_of_house,
            is_mortgaged: false,
            group_id,
            for_sale: true,
            development: 0,
        }
    }

    fn get_rent_amount(
        self: Property, owner_railroads: u8, owner_utilities: u8, dice_rolled: u256,
    ) -> u256 {
        if self.is_mortgaged {
            return 0;
        }

        // Use direct felt252 comparisons instead of enum match
        if self.property_type == 'PROPERTY' {
            match self.development {
                0 => self.rent_site_only,
                1 => self.rent_one_house,
                2 => self.rent_two_houses,
                3 => self.rent_three_houses,
                4 => self.rent_four_houses,
                5 => self.rent_hotel,
                _ => self.rent_site_only,
            }
        } else if self.property_type == 'RAILROAD' {
            match owner_railroads {
                0 => 0,
                1 => 25,
                2 => 50,
                3 => 100,
                4 => 200,
                _ => 0,
            }
        } else if self.property_type == 'UTILITY' {
            match owner_utilities {
                0 => 0,
                1 => 4 * dice_rolled,
                2 => 10 * dice_rolled,
                _ => 0,
            }
        } else {
            0
        }
    }

    fn calculate_utility_rent(self: @Property, no_of_utilities: u8, dice_rolled: u256) -> u256 {
        match no_of_utilities {
            0 => 0,
            1 => 4 * dice_rolled,
            2 => 10 * dice_rolled,
            _ => 0,
        }
    }

    fn calculate_railway_rent(self: @Property, no_of_railways: u8) -> u256 {
        match no_of_railways {
            0 => 0,
            1 => 25,
            2 => 50,
            3 => 100,
            4 => 200,
            _ => 0,
        }
    }

    fn mortgage(ref self: Property, owner: ContractAddress) {
        self.is_mortgaged = true;
    }

    fn lift_mortgage(ref self: Property, owner: ContractAddress) {
        self.is_mortgaged = false;
    }

    fn upgrade_property(ref self: Property, player: ContractAddress, upgrade_level: u8) -> bool {
        // deals with the property level mostly after many checks
        true
    }

    fn downgrade_property(
        ref self: Property, player: ContractAddress, downgrade_level: u8,
    ) -> bool {
        // deals with the property level mostly after many checks
        true
    }

    fn change_game_property_ownership(
        ref self: Property, new_owner: ContractAddress, owner: ContractAddress,
    ) -> bool {
        // deals with the field owner after many checks
        true
    }
}

// // Test module for conversion logic
// #[cfg(test)]
// mod tests {
//     use super::{PropertyType, PropertyTypeTrait, TradeOffer, TradeOfferTrait, TradeStatus, TradeStatusTrait};

//     #[test]
//     fn test_property_type_conversion_roundtrip() {
//         let all_types = PropertyTypeTrait::all();

//         for i in 0..all_types.len() {
//             let ptype = *all_types[i];
//             let felt_val: felt252 = ptype.into();
//             let converted_back: Option<PropertyType> = felt_val.try_into();

//             assert(converted_back.is_some(), 'PropertyType conversion should succeed');
//             assert(converted_back.unwrap() == ptype, 'Should match original PropertyType');
//         }
//     }

//     #[test]
//     fn test_trade_offer_conversion_roundtrip() {
//         let all_offers = TradeOfferTrait::all();

//         for i in 0..all_offers.len() {
//             let offer = *all_offers[i];
//             let felt_val: felt252 = offer.into();
//             let converted_back: Option<TradeOffer> = felt_val.try_into();

//             assert(converted_back.is_some(), 'TradeOffer conversion should succeed');
//             assert(converted_back.unwrap() == offer, 'Should match original TradeOffer');
//         }
//     }

//     #[test]
//     fn test_trade_status_conversion_roundtrip() {
//         let all_statuses = TradeStatusTrait::all();

//         for i in 0..all_statuses.len() {
//             let status = *all_statuses[i];
//             let felt_val: felt252 = status.into();
//             let converted_back: Option<TradeStatus> = felt_val.try_into();

//             assert(converted_back.is_some(), 'TradeStatus conversion should succeed');
//             assert(converted_back.unwrap() == status, 'Should match original TradeStatus');
//         }
//     }

//     #[test]
//     fn test_trade_status_active() {
//         assert(TradeStatusTrait::is_active('PENDING'), 'PENDING should be active');
//         assert(TradeStatusTrait::is_active('COUNTERED'), 'COUNTERED should be active');
//         assert(!TradeStatusTrait::is_active('ACCEPTED'), 'ACCEPTED should not be active');
//         assert(!TradeStatusTrait::is_active('REJECTED'), 'REJECTED should not be active');
//     }
// }