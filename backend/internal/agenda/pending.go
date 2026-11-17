package agenda

import (
	"context"

	"github.com/jackc/pgx/v5"
)

const matchSize = 4

// readPendingMatches fills PendingMatch on the open_match reservations, reading inside the
// transaction that already authorized the actor. Organizer first, then by join time.
func readPendingMatches(ctx context.Context, tx pgx.Tx, reservations []ReservationData) error {
	ids := make([]string, 0)
	index := make(map[string]int)
	for i, r := range reservations {
		if r.Origin == "open_match" {
			ids = append(ids, r.ID)
			index[r.ID] = i
		}
	}
	if len(ids) == 0 {
		return nil
	}
	rows, err := tx.Query(ctx, `SELECT pm.reservation_id::text,pm.id::text,pm.status,array_to_string(ARRAY[pm.target_level]||pm.extra_levels,' / '),r.companions,p.name,p.level,COALESCE(pmp.position,p.position,''),pmp.is_organizer
		FROM pending_matches pm
		JOIN reservations r ON r.id=pm.reservation_id
		JOIN pending_match_players pmp ON pmp.match_id=pm.id
		JOIN player_profiles p ON p.user_id=pmp.user_id
		WHERE pm.reservation_id = ANY($1::uuid[])
		ORDER BY pm.reservation_id,pmp.is_organizer DESC,pmp.joined_at,pmp.user_id`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var reservationID, id, status, level string
		var guestPlayers int
		var player MatchPlayer
		if err := rows.Scan(&reservationID, &id, &status, &level, &guestPlayers, &player.Name, &player.Level, &player.Position, &player.Organizer); err != nil {
			return err
		}
		item := &reservations[index[reservationID]]
		if item.PendingMatch == nil {
			item.PendingMatch = &PendingMatch{ID: id, Status: status, TargetLevel: level, GuestPlayers: guestPlayers, Players: []MatchPlayer{}}
		}
		item.PendingMatch.Players = append(item.PendingMatch.Players, player)
		item.PendingMatch.MissingPlayers = matchSize - len(item.PendingMatch.Players) - item.PendingMatch.GuestPlayers
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()
	guestRows, err := tx.Query(ctx, `SELECT pm.reservation_id::text,g.name,g.slot
		FROM pending_matches pm JOIN pending_match_guests g ON g.match_id=pm.id
		WHERE pm.reservation_id = ANY($1::uuid[]) ORDER BY pm.reservation_id,g.slot`, ids)
	if err != nil {
		return err
	}
	defer guestRows.Close()
	for guestRows.Next() {
		var reservationID string
		var guest GuestPlayer
		if err := guestRows.Scan(&reservationID, &guest.Name, &guest.Slot); err != nil {
			return err
		}
		if item := reservations[index[reservationID]].PendingMatch; item != nil {
			item.Guests = append(item.Guests, guest)
		}
	}
	return guestRows.Err()
}
