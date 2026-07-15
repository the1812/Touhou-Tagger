package domain

import "testing"

func TestMetadataNumbersUseParseIntSemantics(t *testing.T) {
	metadata := []Metadata{
		{Title: "Disc 1 Track 1", DiscNumber: "1/2", TrackNumber: "1/2"},
		{Title: "Disc 1 Track 2"},
		{Title: "Disc 2 Track 1", DiscNumber: "2/2"},
		{Title: "Disc 2 Track 2"},
	}
	actual := ExpandMetadata(metadata, nil)
	wantDisc := []string{"1/2", "1", "2/2", "2"}
	wantTrack := []string{"1/2", "2", "1", "2"}
	for index := range actual {
		if actual[index].DiscNumber != wantDisc[index] || actual[index].TrackNumber != wantTrack[index] {
			t.Fatalf("expanded track %d = disc %q track %q, want disc %q track %q", index+1,
				actual[index].DiscNumber, actual[index].TrackNumber, wantDisc[index], wantTrack[index])
		}
	}

	simplified := SimplifyMetadata([]Metadata{
		{Title: "Disc 1 Track 1", DiscNumber: "1/2", TrackNumber: "1/2"},
		{Title: "Disc 1 Track 2", DiscNumber: "1/2", TrackNumber: "2/2"},
		{Title: "Disc 2 Track 1", DiscNumber: "2/2", TrackNumber: "1/2"},
		{Title: "Disc 2 Track 2", DiscNumber: "2/2", TrackNumber: "2/2"},
	})
	wantDisc = []string{"", "", "2/2", ""}
	for index := range simplified {
		if simplified[index].DiscNumber != wantDisc[index] || simplified[index].TrackNumber != "" {
			t.Fatalf("simplified track %d = disc %q track %q, want disc %q and empty track",
				index+1, simplified[index].DiscNumber, simplified[index].TrackNumber, wantDisc[index])
		}
	}
}
